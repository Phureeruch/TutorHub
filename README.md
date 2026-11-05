# TutorHub

A full-stack application connecting tutors and students.

## Local Setup

### Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL

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
   - Verify or update the database credentials in `.env`:
     ```env
     DATABASE_URL="postgresql://postgres:password@localhost:5432/tutorhub?schema=public"
     ```

4. Push the database schema:
   ```bash
   npx prisma db push
   ```

5. Start the development server:
   ```bash
   npm run dev
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

3. Start the client development server:
   ```bash
   npm run dev
   ```
