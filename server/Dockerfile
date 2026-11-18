FROM node:22-alpine

WORKDIR /app

# Install native compilation dependencies for bcrypt and openssl for Prisma engine
RUN apk add --no-cache openssl python3 make g++

# Copy package manifests and Prisma schema configuration
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install all dependencies (including devDependencies: prisma, tsx, typescript)
RUN npm ci

# Copy TypeScript configuration and application source code
COPY tsconfig.json ./
COPY src ./src/

# Compile Prisma Client and application TypeScript
# (Prisma generation uses the generate-scoped fallback in prisma.config.ts)
RUN npm run build

# Copy and configure entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Configure runtime environment
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
