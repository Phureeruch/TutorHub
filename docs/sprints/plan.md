# TutorHub — Three-Sprint Delivery Plan

## 1. Overview

TutorHub is delivered across **three sprints**, each building on the previous one. The plan follows a vertical-slice strategy aligned with the **Draft 2 SRS Requirements**: 
- **Sprint 1** establishes the baseline vertical slice: authentication with student self-registration and mock verification, continuous tutor availability windows, partial booking with atomic mock payment, and price snapshots.
- **Sprint 2** expands core lifecycle management: search/filtering, 3-tier cancellation and refund calculations, tutor cancellations, interval merging, admin tutor approval, and cloud deployment.
- **Sprint 3** completes the product: session completion, editable student reviews, aggregate tutor rating displays, audit records, and end-to-end quality hardening.

---

## 2. Sprint Timeline

| Sprint | Focus | Deliverable | Deadline |
|:---|:---|:---|:---|
| **Sprint 1** | Baseline — Auth, Registration, Availability Periods, Partial Booking & Atomic Confirmation | Project Deliverable 1 | Nov 8, 2026 |
| **Sprint 2** | Core Expansion — Search, 3-Tier Cancellation & Refunds, Interval Merging, Admin Approval | Project Deliverable 2 | Nov 29, 2026 |
| **Sprint 3** | Completion — Lesson Notes, Editable Reviews, Tutor Ratings, Historical Audit, Hardening | Final Project Delivery | Dec 13, 2026 |

---

## 3. Sprint 1 — Baseline (Deliverable 1)

### Goal
Deliver the thinnest vertical slice proving authentication, student registration, continuous availability, partial booking with interval alignment, atomic mock payment with price snapshotting, and role-based access control work end-to-end (UI → API → DB → View Result).

### Features

| Feature ID | Feature | Requirements Covered |
|:---|:---|:---|
| **F-01** | User Authentication, Registration & Mock Email Verification | FR-01, FR-02, FR-03, FR-04, BR-01, BR-02, BR-03, NFR-01, NFR-03 |
| **F-02** | Tutor Profile & Continuous Availability Period Creation | FR-05, FR-06, BR-04, BR-05, NFR-01 |
| **F-03** | Student Availability Browsing & Discovery | FR-07, BR-05, BR-06 |
| **F-04** | Partial Booking Creation, Atomic Mock Payment & Price Snapshot | FR-08, FR-09, FR-10, BR-05, BR-06, BR-07, BR-08, BR-09, NFR-04 |
| **F-05** | Student Booking Retrieval | FR-11, NFR-02 |
| **F-06** | Tutor Appointment View | FR-11, NFR-02 |
| **F-07** | Admin System-Wide Booking Overview | FR-11, BR-03 |
| **F-08** | Database Seeding & Schema Migrations | NFR-03, NFR-05, Section 9 |

### Key Business Rules Verified in Sprint 1
- **BR-01 & BR-03:** Single role per account and server-enforced role segregation (STUDENT, TUTOR, ADMIN).
- **BR-02:** Student self-registration and mock email verification enforced before booking is allowed.
- **BR-04 & BR-05:** Tutor availability period must be $\ge 1\text{h}$ in whole hours, starting on `:00` or `:30`. Booking start times follow 1-hour intervals aligned with availability start, preventing unbookable fractional fragments.
- **BR-06:** Partial booking permitted within an availability block; remaining time remains bookable in whole hours.
- **BR-07:** Overlapping bookings prevented for the same Tutor and the same Student.
- **BR-08 & NFR-04:** Atomic confirmation and mock payment; race condition conflicts roll back atomically without partial state changes or ghost payment records.
- **BR-09:** Price snapshot ($\text{hourly price} \times \text{duration}$) is recorded and frozen at booking confirmation.
- **NFR-01 & NFR-02:** Backend role authorization and cross-user data isolation.

### Sprint 1 Exit Criteria
- [ ] Student can register, complete mock email verification, and log in.
- [ ] Tutor and Admin can log in with seeded/authorized accounts.
- [ ] A Tutor can create a continuous availability period ($\ge 1\text{h}$) starting at `:00` or `:30`.
- [ ] A Student can browse available tutors and select an availability period.
- [ ] A Student can partially book a whole-hour duration (e.g., 1 hour within a 3-hour period) on valid 1-hour interval marks.
- [ ] Mock payment succeeds, the price snapshot is frozen, and the booking is confirmed atomically.
- [ ] A concurrent booking attempt for the same time is rejected with HTTP `409 Conflict` and rolls back atomically.
- [ ] Student, Tutor, and Admin can view their respective authorized booking lists.
- [ ] Automated tests verify BR-01, BR-02, BR-04, BR-05, BR-06, BR-07, BR-08, BR-09, and NFR-01.
- [ ] Code is merged to `main` via reviewed PRs on `sprint-1-staging`.

---

## 4. Sprint 2 — Core Expansion & Lifecycle Management (Deliverable 2)

### Goal
Extend the platform with advanced discovery/filtering, full booking lifecycle management (3-tier refund policy, tutor cancellations, interval merging), admin tutor approval and subject catalog management, and containerized deployment with CI/CD.

### Features

| Feature ID | Feature | Requirements Covered |
|:---|:---|:---|
| **F-09** | Advanced Search & Filter (by Subject, Tutor, Date/Time) | FR-07 |
| **F-10** | Student Cancellation & 3-Tier Refund Calculation | FR-12, BR-10, BR-11, BR-13, BR-15 |
| **F-11** | Tutor Booking Cancellation Handling | FR-12, BR-12, BR-15 |
| **F-12** | Tutor Availability Management & Interval Merging | FR-06, BR-04, BR-13 |
| **F-13** | Admin Tutor Account Approval & Subject Catalog Management | FR-02, FR-05 |
| **F-14** | Docker Containerization & Cloud Deployment | NFR-03, NFR-05 |
| **F-15** | CI/CD Pipeline (GitHub Actions) | NFR-05 |

### New Business Rules in Sprint 2
- **BR-10:** Confirmed bookings cannot be directly modified; student must cancel and rebook.
- **BR-11:** 3-Tier Student Cancellation Refund:
  - $\ge 72\text{h}$ before lesson: 100% refund.
  - $24\text{h} \le t < 72\text{h}$ before lesson: 50% refund.
  - $< 24\text{h}$ before lesson: 0% refund.
  - Cancellations only allowed prior to lesson start time.
- **BR-12:** Tutor cancellation triggers 100% refund to the student; the cancelled time remains blocked and is not reopened.
- **BR-13:** Student cancellation restores the released time and automatically merges with adjacent available intervals into a single continuous block.
- **BR-15:** System retains audit records for all cancellations, payments, and refunds.

### Dependencies
- Sprint 1 must be complete and merged to `main`.
- Cloud PostgreSQL instance provisioned.
- Cross-team UAT feedback triaged.

### Sprint 2 Exit Criteria
- [ ] Students can search and filter available tutors by subject, date, and time.
- [ ] Students can cancel a booking, and the system accurately calculates 100%, 50%, or 0% refund according to BR-11.
- [ ] Cancelled student bookings restore availability and automatically merge adjacent time intervals.
- [ ] Tutors can cancel bookings; student receives 100% refund and the time slot remains blocked.
- [ ] Admin can approve pending Tutor accounts and manage the subject catalog.
- [ ] Application is containerized with Docker, deployed to cloud infrastructure, and accessible via public URL.
- [ ] GitHub Actions CI runs linting, build, and automated tests on every PR.
- [ ] Sprint 3 contracts (feature SDS, AC, STS) are complete.

---

## 5. Sprint 3 — Completion, Feedback & Quality Hardening (Final Delivery)

### Goal
Complete remaining product features (lesson completion and homework notes, editable student reviews, aggregate tutor rating displays), audit trail retention, test suite hardening, UI polish, and final project demonstration.

### Features

| Feature ID | Feature | Requirements Covered |
|:---|:---|:---|
| **F-16** | Tutor Lesson Completion & Homework Notes | FR-13, BR-14 |
| **F-17** | Student Review Submission & In-Place Editing | FR-14, BR-14 |
| **F-18** | Tutor Aggregate Rating Calculation & Profile Display | FR-15 |
| **F-19** | Historical Records Audit, Regression Suite & Hardening | BR-15, NFR-04, NFR-05 |

### New Business Rules in Sprint 3
- **BR-14:** Only completed lessons can be reviewed. Exactly one review per booking, which the student can edit.
- **BR-15:** Complete audit history retention for bookings, payments, refunds, and reviews.

### Sprint 3 Exit Criteria
- [ ] Tutors can mark appointments as completed and enter lesson notes/homework.
- [ ] Students can rate completed sessions (1–5 stars) and submit written reviews.
- [ ] Students can edit their existing reviews.
- [ ] Tutor profiles calculate and display average rating and review counts.
- [ ] Full regression test suite passes across all Sprint 1–3 features.
- [ ] Demonstration video is recorded with all team members presenting.
- [ ] Final self-contained project documentation and report are compiled and submitted.
- [ ] Code is merged to `main` and tagged (e.g., `v1.0.0-final`).

---

## 6. Feature-to-Sprint Allocation Summary

| Feature ID | Feature Name | Sprint 1 | Sprint 2 | Sprint 3 |
|:---|:---|:---:|:---:|:---:|
| **F-01** | User Auth, Registration & Mock Verification | ✅ | | |
| **F-02** | Tutor Profile & Availability Periods | ✅ | | |
| **F-03** | Student Availability Browsing & Discovery | ✅ | | |
| **F-04** | Partial Booking, Atomic Confirmation & Price Snapshot | ✅ | | |
| **F-05** | Student Booking Retrieval | ✅ | | |
| **F-06** | Tutor Appointment View | ✅ | | |
| **F-07** | Admin System-Wide Booking Overview | ✅ | | |
| **F-08** | Database Seeding & Schema Migrations | ✅ | | |
| **F-09** | Advanced Search & Filter (Subject, Tutor, Date) | | ✅ | |
| **F-10** | Student Cancellation & 3-Tier Refund Engine | | ✅ | |
| **F-11** | Tutor Cancellation Handling | | ✅ | |
| **F-12** | Tutor Availability Editing & Interval Merging | | ✅ | |
| **F-13** | Admin Tutor Approval & Subject Catalog | | ✅ | |
| **F-14** | Docker Containerization & Cloud Deployment | | ✅ | |
| **F-15** | CI/CD Pipeline (GitHub Actions) | | ✅ | |
| **F-16** | Lesson Completion & Homework Notes | | | ✅ |
| **F-17** | Student Review Submission & Editing | | | ✅ |
| **F-18** | Tutor Aggregate Rating Display | | | ✅ |
| **F-19** | Historical Records Audit & Regression Suite | | | ✅ |

---

## 7. Risk Mitigation

| Risk | Impact | Mitigation |
|:---|:---|:---|
| **Partial Booking / Interval Slicing Complexity** | Overlap bugs or dead time fragments | Strictly enforce BR-04 & BR-05 (1-hour interval alignment starting at `:00`/`:30`). Test interval splitting and merging logic thoroughly with unit tests. |
| **Concurrency Race on Booking Confirmation** | Double bookings or ghost payment charges | Enforce BR-08 with database transactions (`SERIALIZABLE` or `SELECT ... FOR UPDATE`); atomically roll back mock payment and booking creation on conflict. |
| **Final Exam Period (Dec 1–11)** | Incomplete Sprint 3 features | Target 90% code completion by Nov 29 (Deliverable 2). Implement F-16 prior to Nov 29. Reserve Dec 12–13 for F-17, F-18, video recording, and final report compilation. |
| **Cloud Deployment Issues** | Delays blocking Deliverable 2 | Start Docker containerization early in Sprint 2. Use local container testing before deploying to cloud infrastructure. |

---

## 8. Team Responsibility Matrix

| Track | Partner 1 | Partner 2 |
|:---|:---|:---|
| **Sprint 1** | Auth & Registration API, Mock Verification UI/API, Availability Creation, Frontend Layout | Booking API, Partial Booking & Conflict Prevention, Mock Payment & Price Snapshot, DB Schema/Seed |
| **Sprint 2** | Advanced Search/Filter, Admin Tutor Approval & Subject Management, Docker & Cloud Setup | 3-Tier Cancellation & Refund Engine, Tutor Cancellation, Interval Merging Logic, CI/CD Pipeline |
| **Sprint 3** | Lesson Completion & Notes (F-16), Tutor Rating Display (F-18), Final Report Compilation | Student Reviews & Editing (F-17), Historical Audit (F-19), Regression Suite, Demo Video |
