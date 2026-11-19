# Stage 1: Build Frontend (React SPA)
FROM node:22-alpine AS client-builder

WORKDIR /app/client

# Install frontend dependencies
COPY client/package*.json ./
RUN npm ci --fetch-retries=5

# Copy frontend source and compile production build
COPY client/ ./
RUN npm run build

# Stage 2: Build Backend & Production Runtime
FROM node:22-alpine

WORKDIR /app

# Install native compilation dependencies for bcrypt and openssl for Prisma engine
RUN apk add --no-cache openssl python3 make g++

# Copy server package manifests and Prisma schema configuration
COPY server/package*.json ./
COPY server/prisma ./prisma/
COPY server/prisma.config.ts ./

# Install all server dependencies (including devDependencies: prisma, tsx, typescript)
RUN npm ci --fetch-retries=5

# Copy server TypeScript configuration and source code
COPY server/tsconfig.json ./
COPY server/src ./src/

# Compile Prisma Client and application TypeScript
# (Prisma generation uses the generate-scoped fallback in prisma.config.ts)
RUN npm run build

# Copy built frontend assets from client-builder stage into server static directory
COPY --from=client-builder /app/client/dist ./client/dist

# Copy and configure entrypoint script
COPY server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Configure runtime environment
ENV NODE_ENV=production
ENV PORT=3000
ENV CLIENT_DIST_DIR=/app/client/dist
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
