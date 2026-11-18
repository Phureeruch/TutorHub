# TutorHub Deployment Documentation (Lab 5)

## 1. Stack and Architecture

TutorHub is a full-stack peer tutoring web application built with a React TypeScript frontend and a Node.js Express TypeScript backend, backed by PostgreSQL via Prisma ORM.

### Reference Architecture vs. TutorHub Adaptations

| Component | Reference Stack (TokTickIT) | TutorHub Architecture |
|---|---|---|
| **Frontend** | React 18, Vite, Bootstrap | React 19, Vite 6, Bootstrap 5, TypeScript |
| **Backend** | Express 4, TypeScript, Prisma 5 | Express 5, TypeScript, Prisma 7 with `@prisma/adapter-pg` |
| **Database** | PostgreSQL 16 on Cloud SQL | PostgreSQL (15+ / 16 on Cloud SQL `db-f1-micro`) |
| **Authentication** | Session / password hash with `mustChangePassword` | Stateless Bearer JWT (`jsonwebtoken` + `bcrypt`), stored in client `localStorage` |
| **Attachment Storage** | Saved as database bytes (`BYTEA`) | PostgreSQL database storage (`fileData BYTEA` in `BookingAttachment` table) |
| **Containerization** | Unified multi-stage Docker container | Unified container serving React SPA static files via Express on port 3000 |
| **Process Model** | `node dist/index.js` on `0.0.0.0:$PORT` | `node dist/server.js` on `0.0.0.0:$PORT` |

---

## 2. Environment Variables

All settings are read from the environment at startup. No secrets or connection strings are baked into container images or committed to the repository.

| Variable Name | Purpose | Secret? | Source (Dev / Test) | Source (Production / Cloud Run) |
|---|---|:---:|---|---|
| `PORT` | Listening port for Express HTTP server | No | `.env` (default: 3000) | Injected automatically by Cloud Run (default: 3000) |
| `NODE_ENV` | Runtime mode (`development`, `test`, `production`) | No | `.env` (`development` or `test`) | Cloud Run container environment variable (`production`) |
| `DATABASE_URL` | PostgreSQL connection string | **Yes** | `server/.env` (local container port 5433) | Secret Manager (`tutorhub-database-url:latest` via Cloud SQL socket) |
| `JWT_SECRET` | Secret key used for signing & verifying JWT tokens | **Yes** | `server/.env` | Secret Manager (`tutorhub-jwt-secret:latest`) |
| `ADMIN_PASSWORD` | Initial password for the seeded administrator account | **Yes** | `server/.env` (fallback `password123` in dev) | Secret Manager (`tutorhub-admin-password:latest`) |
| `DEMO_USER_PASSWORD` | Password for seeded demo accounts (tutors, students) | **Yes** | `server/.env` (fallback `password123` in dev) | Secret Manager (`tutorhub-demo-password:latest`, optional) |
| `SEED_DEMO_DATA` | Toggle whether non-admin demo records are seeded | No | `server/.env` (default: `true`) | Cloud Run job environment variable (`false` or `true`) |
| `CORS_ORIGIN` | Allowed cross-origin resource sharing URL | No | `server/.env` (default: `http://localhost:5173`) | Cloud Run container environment variable |
| `CLIENT_DIST_DIR` | Filesystem path where built client static assets live | No | Local build directory | Docker container image path (`/app/client/dist`) |
| `VITE_API_TARGET` | Dev proxy target URL for local Vite development server | No | `client/.env` (default: `http://localhost:3000`) | N/A (Production client connects to same origin) |
| `VITE_USE_MOCK` | Toggle mock browser storage mode for unit tests | No | `client/.env` (default: `false`) | N/A (Always `false` in production build) |
| `VITE_ENABLE_DEMO_TOOLBAR` | Toggle visibility of DemoToolbar in UI | No | `client/.env` (default: `false` in prod) | Set at client build time (default: `false`) |
| `VITE_SHOW_DEV_HINTS` | Toggle visibility of dev seed account hints in login | No | `client/.env` (default: `false` in prod) | Set at client build time (default: `false`) |

---

## 3. Operational Commands

### Local Development Setup
```bash
# 1. Start local PostgreSQL database container (port 5433)
docker compose up -d postgres

# 2. Setup server environment
cd server
cp .env.example .env
npm ci
npm run db:migrate
npm run seed
npm run dev

# 3. Setup client environment (in another terminal)
cd client
cp .env.example .env
npm ci
npm run dev
```

### Build & Verification Commands
```bash
# Compile backend TypeScript
npm --prefix server run build

# Run backend unit tests (no database required)
npm --prefix server run test:unit

# Run full backend test suite (requires PostgreSQL test database)
npm --prefix server test

# Compile frontend and verify production build
npm --prefix client run build

# Run frontend tests
npm --prefix client test
```

### Database Migration & Seed Commands
```bash
# Apply pending migrations to database
npm --prefix server run db:migrate
# or: npx prisma migrate deploy (inside server directory)

# Seed initial data (idempotent; safe to rerun)
npm --prefix server run seed
# or: npm --prefix server run prisma:seed
```

---

## 4. Google Cloud Platform Configuration

> [!NOTE]
> Values marked with **TODO** are provisioned during GCP project setup (Episodes 1, 5, 6) and must be filled in with your team's assigned identifiers.

| Resource | Value / Identifier | Notes |
|---|---|---|
| **GCP Project ID** | `TODO: YOUR_PROJECT_ID` | Formed during Episode 1 (e.g., `cpe334-sec1-teamXX`) |
| **GCP Region** | `asia-southeast1` | Singapore region (low latency to Thailand) |
| **Artifact Registry** | `tutorhub` | Docker container registry repository |
| **Container Image URI** | `asia-southeast1-docker.pkg.dev/TODO_PROJECT_ID/tutorhub/tutorhub` | Tagged with commit SHA |
| **Cloud SQL Instance** | `tutorhub-pg` | `db-f1-micro`, PostgreSQL 16, enterprise edition, auto-increase OFF |
| **Cloud SQL Database** | `tutorhub` | Primary application database |
| **Runtime Service Account** | `tutorhub-runner@TODO_PROJECT_ID.iam.gserviceaccount.com` | Least privilege: `roles/cloudsql.client` + secret accessor |
| **Deployer Service Account** | `tutorhub-deployer@TODO_PROJECT_ID.iam.gserviceaccount.com` | Used by GitHub Actions WIF |
| **Cloud Run Service** | `tutorhub` | Port 3000, 1 CPU, 512MiB RAM, 0 to 3 instances |
| **Cloud Run Migration Job** | `tutorhub-migrate` | Runs `npx prisma migrate deploy && npm run seed` |

---

## 5. Release & Rollback Procedure

### Standard Release Flow
1. **Branching & PR Review:**
   - Features and bug fixes are developed on feature branches branched from `Lab5-staging` (or `staging`).
   - A Pull Request is opened into `Lab5-staging`. Teammate reviews and approves.
   - A release Pull Request is opened from `Lab5-staging` into `main`.
2. **Automated CI Quality Gate (`test-and-docker`):**
   - GitHub Actions workflow runs the required status check: offline deploy script tests, backend migration/seed/tests, frontend tests/build, and Docker container build.
   - Ruleset `protect-main` blocks merging if `test-and-docker` fails or teammate approval is missing.
3. **Automated CD Pipeline:**
   - Merging into `main` triggers `.github/workflows/deploy.yml`.
   - The workflow authenticates via Workload Identity Federation (no JSON key).
   - The production container is built and tagged with the 40-character commit SHA (`IMAGE_TAG`).
   - Cloud Run migration job runs database migrations.
   - Cloud Run service updates to the new image digest and routes 100% traffic.
   - Automated read-only smoke tests (`deploy/smoke_test.py`) verify `/api/health`, `/api/ready`, `/`, and `/api/subjects`.

### Identifying the Running Release
1. Open Cloud Run in the Google Cloud Console (`https://console.cloud.google.com/run`).
2. Select the `tutorhub` service and open the **Revision history** tab.
3. The active revision serving 100% traffic displays the container image digest and tag matching the Git commit SHA from `main`.
4. The deployment summary recorded in the GitHub Actions `Deploy demo` workflow run also logs the commit SHA, image digest, and public service URL.

### Rollback Procedure
1. If an issue occurs on production, go to GitHub **Actions** > **Deploy demo** > **Run workflow**.
2. Select branch `main`.
3. In the `image_tag` input field, enter the full 40-character commit SHA of the previous working release.
4. Run the workflow. Tests, image building, and migration will be skipped; Cloud Run will immediately redirect traffic to the known-good image digest and run smoke tests.
