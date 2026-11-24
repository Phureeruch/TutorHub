# TutorHub — Change, Defect & Baseline Revision Register

**Version:** 1.3 (Updated BRV-04 & CHG-02 after Sprint 2 Design System Restyle)  
**Date:** 2026-11-24  
**Authors:** Korapin Manoprasertkoon (`67070503458`), Phureeruch Satithangkul (`67070503471`)  
**Course:** CPE 334 — Project Deliverable 2 (Part A)

---

## 1. Accepted Sprint 1 Baseline & Continuity Reference

| Attribute | Value |
|---|---|
| **Accepted Sprint 1 Tag** | `v1.0.0-sprint1` |
| **Accepted Sprint 1 Commit** | `0eac19950d5facf81137578620ed10d8e7d3b52f` (Merge PR #26 from `sprint-1-staging`, 2026-11-18) |
| **Lab 5 Deployed Baseline** | `3ef0898d606dbd679919444174537c515df05294` (Merge PR #37 from `Lab5-staging`, 2026-11-22) |
| **Lab 6 Post-UAT Baseline (`main` / `sprint-2-staging`)** | `f235153e1528e6302f14d57a0ee7e4a72c6333e0` (Merge PR #48 from `Lab5-staging`, 2026-11-24) |
| **Production GCP URL** | `https://tutorhub-382215818465.asia-southeast1.run.app` |

### Original Sprint 1 Critical Domain Journey (Continuity Verification Target)
Every Deliverable 2 candidate (`v2.0.0-sprint2`, `v2.1.0-d2-rc`) must continue to pass the full Sprint 1 vertical slice without regression:
1. Student self-registers (`POST /api/auth/register`) and completes mock email verification (`POST /api/auth/verify-email`).
2. Approved Tutor logs in (`POST /api/auth/login`) and creates a continuous availability block (`>= 1h`, whole hours, `:00` or `:30` start via `POST /api/tutor/availability`).
3. Student discovers the tutor (`GET /api/availability`) and books a partial whole-hour interval with atomic mock payment and frozen price snapshot (`POST /api/bookings` → `201`, remaining open interval preserved).
4. Concurrent/overlapping booking attempt is rejected atomically (`409 Conflict`, zero partial writes or ghost payment records).
5. Student, Tutor, and Admin retrieve only their authorized booking records (`GET /api/bookings`, `GET /api/bookings/:id`, `GET /api/admin/summary`; cross-user access returns `403 Forbidden`).

---

## 2. Approved Baseline Revisions

All revisions below are retained in the current product baseline without rewriting prior history.

| Revision ID | Date | Document / Layer Affected | Description of Revision | Rationale | Approval / Commit |
|---|---|---|---|---|---|
| **BRV-01** | 2026-11-07 | SRS (`docs/srs.md`), Sprint Plan (`docs/sprints/plan.md`), System SDS (`docs/system-sds.md`) | Adopted SRS Draft 2 (v2.0): `:00`/`:30` 1-hour aligned availability/booking windows (BR-04, BR-05), atomic mock payment without temporary checkout hold timers (BR-08), 3-tier refund boundaries (BR-11), and interval merging on student cancellation (BR-13). | Eliminated unbookable 30-minute "dead fragments" and removed out-of-scope cart-hold complexity while preserving concurrency safety via `Serializable` transactions + GiST exclusion constraints. | PR #10 (`f3c9e21`), PR #11 (`daf8203`) |
| **BRV-02** | 2026-11-18 | SRS v2.1, Prisma Schema, Backend API, Frontend UI | Moved per-subject hourly rates (THB), teaching levels (`HIGH_SCHOOL`, `UNDERGRADUATE`, `GRADUATE`), subject topics (`<= 200` chars) (`FR-05`), optional booking lecture-file attachments (`<= 5` files, `<= 20 MB` each, `FR-08`, `BR-08`), and `Decimal(10, 2)` monetary columns into scope. | Team prototype review decisions (R1–R5 in `docs/backend-api-guide.md`) improved domain realism for multi-subject tutors and eliminated floating-point rounding drift for 50% refunds. | PR #12 (`c9fd263`), PR #15 (`0c0e00d`), PR #26 (`0eac199`) |
| **BRV-03** | 2026-11-18 | Prisma Schema (`BookingAttachment.fileData`), Backend API, Infrastructure | Migrated lecture-file attachment persistence from ephemeral local disk (`UPLOAD_DIR`) to PostgreSQL `BYTEA` (`20261118220000_store_attachment_file_data`), added `/api/health` and `/api/ready`, and unified production static SPA serving in Express. | Google Cloud Run containers are stateless; storing attachments in PostgreSQL guarantees durability across container restarts and scaling (`NFR-03`). | PR #27 (`6f77ddb`, `dce75b7`) |
| **BRV-04** | 2026-11-24 | Frontend Styling (`client/src/index.css`, `client/index.html`, `docs/STYLE_GUIDE.md`) | Approved light-mode 60/30/10 design system refresh (`#F7F4EA` warm cream, `#5476C4` blue, `#00072D` deep navy, `Plus Jakarta Sans`) prior to Sprint 2 UI implementation; dark mode and rating/trust UI explicitly deferred to Sprint 3 (`F-17`/`F-18`). | Establishes consistent accessible (WCAG AA) tokens once before building Sprint 2/3 screens without changing any functional behavior, API contracts, or test assertions. | Implemented — `style/design-system-restyle` (Issue #2) |

---

## 3. Change & Defect Register (Labs 5–7 Deployment, UAT & Maintenance)

> **Note for Deliverable 2 Finalization:** All Lab 5 deployment/CI items, Lab 6 independent UAT results (QuickOrder partner team, including PR #47 / PR #48 fix for Issue `#46`), and Sprint 2 readiness audit findings are logged below. Append any Lab 7 maintenance findings prior to `v2.1.0-d2-rc`.

| ID | Source | Affected Req / Feature | Finding / Issue Summary | Accepted Decision | Status | Fix / Change Release | Re-test Outcome |
|---|---|---|---|---|---|---|---|
| **CHG-01** | Lab 5 Deployment | `FR-08`, `NFR-03` / `F-04`, `F-14` | Ephemeral container filesystem loses uploaded lecture attachments on Cloud Run restart/redeploy; missing standard health/readiness endpoints for smoke checks. | Migrate attachment storage to PostgreSQL `BYTEA` (`fileData`), add `/api/health` & `/api/ready`, and parameterize runtime secrets via env vars. | **Resolved** | PR #27 (`6f77ddb`, `dce75b7`) | Passed backend integration tests, Docker Compose persistence check, and Cloud Run smoke test. |
| **DEF-01** | Lab 5 PR Review | `NFR-03`, `NFR-05` / `F-08`, `F-14` | Code review on PR #27 identified issues in `prisma.config.ts`, `seed.ts` idempotency/password handling, `.env.example` completeness, and `server.ts` CORS/startup behavior. | Address all review findings before merging cloud-ready refactor to `main`. | **Resolved** | PR #27 (`5e40ca8`, `dce75b7`) | Passed teammate re-review, local tests, and CI build. |
| **DEF-02** | Lab 5 CI Verification | `NFR-05` / `F-15` | Backend CI job in `.github/workflows/ci-docker.yml` failed during `npm run seed` because Prisma Client had not been generated yet. | Add `npx prisma generate` step before `npx prisma migrate deploy` and `npm run seed`. | **Resolved** | PR #29 (`a5fbfb0`, `c687eb2`) | `test-and-docker` workflow passed end-to-end on GitHub Actions. |
| **DEF-03** | Lab 5 Maintenance | `NFR-05` / `F-08` | Demo seed arrays in `server/prisma/seed.ts` were declared outside `main()` scope, risking unintended evaluation when `SEED_DEMO_DATA=false`. | Move demo availability and booking seed data cleanly inside `main()` gated by `seedDemoData`. | **Resolved** | PR #29 (`e6a4a8f`, `c687eb2`) | Verified idempotent seeding for both `SEED_DEMO_DATA=true` and `false`. |
| **DEF-04** | Lab 5 GCP Deployment | `NFR-01`, `NFR-05` / `F-14` | `deploy/deploy.sh` and `deploy/teardown.sh` did not wire `JWT_SECRET` (`tutorhub-jwt-secret`) into Cloud Run Secret Manager configuration, blocking authenticated endpoints in production. | Add Secret Manager creation/binding for `tutorhub-jwt-secret` in deploy/teardown scripts and add regression coverage in `deploy/tests/test_deploy_stub.sh`. | **Resolved** | PR #29 / PR #30 (`6c2fcd3`, `7f71089`) | Passed `test_deploy_stub.sh` and verified authenticated login on Cloud Run. |
| **CHG-02** | Lab 5 Deploy Proof | `FR-01` / `F-01`, `F-14` | Temporary "Release 2" deploy-proof badge added to login header (`client/src/components/auth/AuthView.tsx`) to visually confirm automated CD rollout. | Retain in Lab 5 release (`883fd17`), then remove temporary lab badge cleanly during Sprint 2 UI restyle so production login header stays clean. | **Resolved** | `style/design-system-restyle` (Issue #2) | Removed `(release 2)` text in `AuthView.tsx`; verified zero test dependency & CSS/token checks; pending local/CI `npm --prefix client run lint/test/build` verification on PR. |
| **DEF-05** | Sprint 2 Readiness Audit (Lab 5 CI) | `NFR-05` / `F-15` | `.github/workflows/ci-docker.yml` does not run `npm run lint` on the frontend (required by Sprint 2 exit criteria) and only triggers on `[main, Lab5-staging]`, excluding `sprint-2-staging` and `sprint-3-staging`. | Add `npm run lint` to frontend CI job and add `sprint-2-staging` & `sprint-3-staging` PR triggers. | **Remaining** | Planned — Issue #5 (`v2.0.0-sprint2`) | Pending verification in Issue #5. |
| **DEF-06** | Sprint 2 Readiness Audit (Docs Drift) | `NFR-03`, `NFR-05` / `F-14`, Part D | `README.md` still documents Sprint 1 DB port `5433` and disk `UPLOAD_DIR` instead of Lab 5 Docker Compose port `5434` and PostgreSQL `BYTEA`; `docs/system-sds.md` still cites React 18 and omits `BookingAttachment.fileData`. | Reconcile `README.md` (Issue #5) and `docs/system-sds.md` (Issue #7) with actual Docker/Cloud Run configuration and Prisma schema. | **Remaining** | Planned — Issues #5 & #7 (`v2.0.0-sprint2` / `v2.1.0-d2-rc`) | Pending verification in Issues #5 & #7. |
| **DEF-07** | Sprint 2 Readiness Audit (Seed Data) | `FR-02`, `BR-02` / `F-08`, `F-13` | `server/prisma/seed.ts` seeds only pre-approved tutors (`Alice`, `Bob`), leaving no pending tutor account for testing or demonstrating Admin approval (`F-13`). | Add an idempotent unapproved sample tutor account (`evan.pending@tutorhub.dev`, `isApproved: false`) to demo seed data and enforce `isApproved === true` on availability creation. | **Resolved** | `feat/discovery-and-admin` (Issue #41) | Seeded `evan.pending@tutorhub.dev` in `seed.ts`; verified unapproved tutor cannot create availability (`403`); verified admin approval flow end-to-end in unit and integration test suites. |
| **DEF-08** | Sprint 2 Cross-Feature Audit | `FR-11`, `FR-12`, `BR-11`, `BR-15` / `F-07`, `F-10` | `getAdminSummary()` (`server/src/services/admin.service.ts`) excludes all `CANCELLED` bookings from `mockRevenue`, which would under-report retained revenue when a student cancels with a 50% or 0% refund. | Update `mockRevenue` aggregation to compute retained payments (`SUM(totalPrice - COALESCE(refundAmount, 0))`) across all bookings and align `client/src/components/admin/adminSummary.ts`. | **Remaining** | Planned — Issue #5 (`v2.0.0-sprint2`) | Pending cross-feature regression test in Issue #5 & Issue #7. |
| **UAT-L6-01** | Lab 6 Independent UAT (QuickOrder — Ivan Luwongsuwat & Panyakorn Lohaviboonsap, 2026-11-23) | `F-01`–`F-08` (Sprint 1 Scope) | Independent execution of Sprint 1 UAT cases (`UAT-S1-01`–`UAT-S1-05`) on live Cloud Run (`883fd17` / `3ef0898` docs-only equivalent) passed all 5 cases with **0 genuine defects**. | Record honest zero-defect initial UAT acceptance; execute Instructor's standardized Lab 6 Special Exercise on `Lab5-staging` (`f26a333`) to verify defect-fix workflow without breaking live `main`. | **Resolved** | Initial Sprint 1 UAT accepted on `883fd17` / `3ef0898` | All 5 UAT cases (`UAT-S1-01`–`UAT-S1-05`) passed on Cloud Run. |
| **UAT-L6-02** *(Issue `#46`)* | Lab 6 Special Exercise UAT (QuickOrder) | `FR-02` / `F-01` (Student Registration) | Blank/whitespace-only full name was accepted on student registration on controlled staging build `Lab5-staging` (`f26a333`, PR #45 `3bf0624`), allowing nameless student accounts. | Accepted Major defect (controlled exercise). Add RED reproducing tests (`api.integration.test.ts`, `App.test.tsx`), restore required full-name validation (`auth.service.ts`, `AuthView.tsx`), merge via PR #47 (`Lab5-staging`) and PR #48 (`main`), sync into `sprint-2-staging`, redeploy to Cloud Run, and verify re-test. | **Resolved** | PR #47 (`a1aa9fe` → `Lab5-staging`), PR #48 (`f235153` → `main` & `sprint-2-staging`); RED `48902f1`, GREEN `c7875d3` | Automated RED → GREEN backend (`api.integration.test.ts`) & frontend (`App.test.tsx`) regression tests and GitHub Actions `test-and-docker` CI passed on PR #47 & PR #48; auto-deployed to Cloud Run (`f235153`) with smoke checks passing and regression fix carried into `sprint-2-staging`. |

---

## 4. Revision History of This Document

| Version | Date | Author(s) | Summary |
|---|---|---|---|
| 1.0 | 2026-11-23 | Korapin, Phureeruch | Initial Sprint 2 baseline register documenting Sprint 1 tag (`v1.0.0-sprint1`), approved revisions (`BRV-01`–`BRV-04`), resolved Lab 5 findings (`CHG-01`, `DEF-01`–`DEF-04`), and open Sprint 2 maintenance/readiness items (`CHG-02`, `DEF-05`–`DEF-08`). |
| 1.1 | 2026-11-24 | Korapin, Phureeruch | Replaced `UAT-01` placeholder with real Lab 6 independent UAT outcomes (`UAT-L6-01`, `UAT-L6-02` / Issue `#46` commits `f26a333`, `48902f1`, `c7875d3`) and aligned author names/IDs. |
| 1.2 | 2026-11-24 | Korapin, Phureeruch | Addressed PR review on Issue `#38`: updated `UAT-L6-02` (`#46`) status to `Resolved` with verified merge commits PR #47 (`a1aa9fe`) and PR #48 (`f235153` on `main` & `sprint-2-staging`) and recorded post-merge CI/regression re-test evidence. |
| 1.3 | 2026-11-24 | Korapin | Implemented Sprint 2 light-mode design system refresh (`BRV-04`, `docs/STYLE_GUIDE.md`) and marked `CHG-02` (`(release 2)` badge removal) `Resolved` on `style/design-system-restyle`. |
| 1.4 | 2026-11-25 | Phureeruch | Resolved DEF-07 in Issue #41 (Sprint 2 Issue 4): seeded idempotent unapproved tutor `evan.pending@tutorhub.dev`, enforced tutor approval checks, and implemented admin tutor approval queue. |
