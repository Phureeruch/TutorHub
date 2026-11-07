# Requirements Traceability Matrix (RTM) — TutorHub

**Version:** 2.0 (Aligned with SRS Draft 2)  
**Authors:** Korapin Manochokecharoen, Phureeruch Satithangkul  
**Course:** CPE 334  

---

## 1. Functional Requirements Traceability

| ID | Requirement Description | Implementation Component / Architectural Mechanism | Sprint | Responsible | Verification Method |
|:---|:---|:---|:---:|:---|:---|
| **FR-01** | User Authentication (Login/Logout) | `POST /api/auth/login`, `POST /api/auth/logout`, `authMiddleware` | 1 | Korapin | Automated API Integration Test |
| **FR-02** | Registration & Account Management | `POST /api/auth/register`, `PATCH /api/admin/tutors/:id/approve` | 1, 2 | Korapin | Automated API Integration Test |
| **FR-03** | Role-Based Access Control | `roleMiddleware.ts`, `Role` enum in Prisma | 1 | Korapin | Automated Unit & Security Test |
| **FR-04** | Mock Email Verification & Password Reset | `POST /api/auth/verify-email`, `POST /api/auth/reset-password` | 1 | Korapin | Automated API Integration Test |
| **FR-05** | Tutor Profile, Subject & Hourly Price Mgmt | `PUT /api/tutor/profile`, `POST /api/admin/subjects` | 1, 2 | Korapin | Automated API Integration Test |
| **FR-06** | Tutor Availability Management | `POST /api/tutor/availability`, `DELETE /api/tutor/availability/:id` | 1, 2 | Korapin | Automated API Integration Test |
| **FR-07** | Student Tutor Discovery & Availability Browsing | `GET /api/availability` (filter by subject, tutor, date) | 1, 2 | Korapin | Automated API Integration Test |
| **FR-08** | Booking Creation with Duration Selection | `POST /api/bookings` (`tutorId, subjectId, startTime, durationHours`) | 1 | Phureeruch | Automated API Integration Test |
| **FR-09** | Booking Conflict Prevention | `booking.service.ts` (Overlap queries for Tutor and Student) | 1 | Phureeruch | Automated Integration Test |
| **FR-10** | Mock Payment & Price Snapshot | `payment.service.ts`, `hourlyPriceSnapshot` in `Booking` model | 1 | Phureeruch | Automated Unit & Integration Test |
| **FR-11** | Booking Information Retrieval (Role-Filtered) | `GET /api/bookings`, `GET /api/bookings/:id` | 1 | Phureeruch | Automated API Integration Test |
| **FR-12** | Booking Cancellation & Automatic Refund | `PATCH /api/bookings/:id/cancel` (3-tier refund & tutor cancellation) | 2 | Phureeruch | Automated Unit & Integration Test |
| **FR-13** | Lesson Completion & Homework Notes | `PATCH /api/bookings/:id/complete` (`lessonSummary`) | 3 | Korapin | Automated API Integration Test |
| **FR-14** | Student Reviews & In-Place Editing | `POST /api/reviews`, `PUT /api/reviews/:id` | 3 | Phureeruch | Automated API Integration Test |
| **FR-15** | Tutor Average Rating Display | `GET /api/tutors/:id/reviews` (Aggregate average rating) | 3 | Korapin | Automated Unit Test |

---

## 2. Business Rules Traceability

| ID | Business Rule | Enforcement Mechanism | Sprint | Responsible | Verification Method |
|:---|:---|:---|:---:|:---|:---|
| **BR-01** | User Roles (STUDENT, TUTOR, ADMIN) | Database `Role` enum + `roleMiddleware` | 1 | Phureeruch | Database Schema & Unit Test |
| **BR-02** | Account Creation & Verification | `isEmailVerified` check in `POST /api/bookings`, Admin approval flag | 1 | Korapin | Automated API Test (400 if unverified) |
| **BR-03** | Access Permissions & Resource Ownership | Server-side ownership checks (`req.user.id === resource.userId`) | 1 | Korapin | Automated Security Test (403 Forbidden) |
| **BR-04** | Availability Duration & Start Times | Validation: $\ge 1\text{h}$, whole hours, start time on `:00` or `:30` | 1 | Korapin | Automated Unit Test |
| **BR-05** | Booking Alignment (No Dead Fragments) | Validation: 1-hour interval from availability start, whole hours | 1 | Phureeruch | Automated Unit Test |
| **BR-06** | Availability & Partial Booking | Dynamic availability interval slicing in `availability.service.ts` | 1 | Phureeruch | Automated Unit & Integration Test |
| **BR-07** | Booking Conflict Prevention | Range overlap query: `NOT (endTime <= newStart OR startTime >= newEnd)` | 1 | Phureeruch | Automated Integration Test (409 Conflict) |
| **BR-08** | Booking Confirmation & Atomic Rollback | `prisma.$transaction` rollback on race collision | 1 | Phureeruch | Concurrent Load Test |
| **BR-09** | Price Snapshot | Frozen `hourlyPriceSnapshot` and `totalPrice` saved in `Booking` | 1 | Phureeruch | Automated Integration Test |
| **BR-10** | Confirmed Booking Changes (Cancel & Rebook) | Immutable schedule fields on confirmed bookings | 2 | Phureeruch | Automated API Test |
| **BR-11** | Student Cancellation 3-Tier Refund | `refund.service.ts`: 100% ($\ge 72\text{h}$), 50% ($[24\text{h}, 72\text{h})$), 0% ($< 24\text{h}$) | 2 | Phureeruch | Automated Unit Test (Boundary Tests) |
| **BR-12** | Tutor Cancellation Policy | 100% refund to student, time permanently blocked (no reopening) | 2 | Phureeruch | Automated Integration Test |
| **BR-13** | Availability Restoration & Interval Merging | `mergeAdjacentIntervals()` algorithm in `availability.service.ts` | 2 | Phureeruch | Automated Unit Test |
| **BR-14** | Lesson Completion & Review Policy | Only `COMPLETED` bookings reviewable; `@unique([bookingId])`; editable | 3 | Phureeruch | Automated API Test |
| **BR-15** | Historical Records Audit | Soft-delete / status preservation in `Booking` and `PaymentStatus` | 2, 3 | Phureeruch | Automated Data Audit Test |

---

## 3. Non-Functional Requirements Traceability

| ID | Category | Requirement Description | Implementation / Architectural Mechanism | Sprint | Responsible | Verification Method |
|:---|:---|:---|:---|:---:|:---|:---|
| **NFR-01** | Security — Authorization | Role & ownership validation on all protected endpoints | Express middleware (`authMiddleware`, `roleMiddleware`) | 1 | Korapin | Automated Security & Pen-Testing |
| **NFR-02** | Security — Data Privacy | Strict cross-user data isolation | User ID query scoping (`studentId = req.user.id`) | 1 | Phureeruch | Automated Multi-User Privacy Test |
| **NFR-03** | Data Persistence | Data persists across restarts in PostgreSQL | PostgreSQL database, Prisma ORM, automated migrations | 1 | Phureeruch | Restart & Migration Verification |
| **NFR-04** | Data Integrity & Atomicity | Prevent conflicting bookings under race conditions | PostgreSQL ACID transactions via `prisma.$transaction` | 1 | Phureeruch | Concurrency Stress Test |
| **NFR-05** | Testing & Maintainability | Automated tests for business rules, migrations, and seeds | Vitest / Jest test suites, GitHub Actions CI, Prisma seeds | 1, 2, 3 | Korapin & Phureeruch | CI Build & Automated Test Suite |
