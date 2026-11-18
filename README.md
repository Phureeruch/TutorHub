# TutorHub

A full-stack application connecting tutors and students.

## Local Setup

### Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL (or Docker to run `docker-compose.yml`)

---

### Database Setup (Docker)

Start PostgreSQL on port `5433`:
```bash
docker compose up -d
```

---

### Server Setup

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env` and verify the values:
     ```env
     DATABASE_URL="postgresql://postgres:password@localhost:5433/tutorhub?schema=public"
     JWT_SECRET="change-me-to-a-long-random-string"
     PORT=3000
     UPLOAD_DIR="uploads"
     ```

4. Generate Prisma client, apply database migrations, and seed sample data:
   ```bash
   npx prisma generate
   npm run db:migrate
   npm run seed
   ```

5. Start the development server (`http://localhost:3000`):
   ```bash
   npm run dev
   ```

6. Run server unit & integration tests (requires a `tutorhub_test` database with migrations applied):
   ```bash
   npm test
   ```

---

### Client Setup

1. Navigate to the `client` directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the client development server (`http://localhost:5173`, proxying `/api` to `:3000`):
   ```bash
   npm run dev
   ```

4. Run client lint, tests, and build:
   ```bash
   npm run lint
   npm test
   npm run build
   ```
