# TutorHub — Three-Sprint Delivery Plan

## 1. Overview

TutorHub is delivered across **three sprints**, each building on the previous one. The plan follows a vertical-slice strategy: Sprint 1 establishes the minimum working booking workflow end-to-end, Sprint 2 expands core features and lifecycle management, and Sprint 3 completes the product with feedback, completion tracking, and quality hardening.

---

## 2. Sprint Timeline

| Sprint | Focus | Deliverable | Deadline |
|:---|:---|:---|:---|
| **Sprint 1** | Baseline — Auth, Slots, Booking | Project Deliverable 1 | Nov 8, 2026 |
| **Sprint 2** | Core Expansion — Search, Cancellation, Admin | Project Deliverable 2 | Nov 29, 2026 |
| **Sprint 3** | Completion — Feedback, Ratings, Hardening | Final Project Delivery | Dec 13, 2026 |

---

## 3. Sprint 1 — Baseline (Deliverable 1)

### Goal
Deliver the thinnest vertical slice that proves authentication, database persistence, exclusive slot booking, and role-based access control work end-to-end (UI → API → DB → View Result).

### Features

| Feature ID | Feature | Requirements Covered |
|:---|:---|:---|
| **F-01** | Authentication & Identity | FR-01, FR-02, NFR-01, NFR-03 |
| **F-02** | Tutor Availability Slot Creation | FR-03, BR-02, BR-03, BR-06 |
| **F-03** | Student Slot Browsing | FR-04 |
| **F-04** | Student Booking Creation | FR-05, BR-01, BR-02, BR-03 |
| **F-05** | Student Booking Retrieval | FR-06, NFR-02 |
| **F-06** | Tutor Appointment View | FR-07, NFR-02 |
| **F-07** | Admin Booking Overview | FR-08, BR-03 |
| **F-08** | Database Seeding | NFR-04, NFR-05 |

### Key Business Rules Verified in Sprint 1
- **BR-01:** Slot exclusivity — double booking rejected (409 Conflict).
- **BR-02:** No past slots — past timestamps rejected (400 Bad Request).
- **BR-03:** Role segregation — students cannot create slots, tutors cannot book (403 Forbidden).
- **BR-06:** End time must be after start time (400 Bad Request).
- **NFR-01:** Backend authorization enforced on all endpoints.
- **NFR-02:** Students cannot see other students' bookings (403 Forbidden).

### Sprint 1 Exit Criteria
- [ ] All three roles can log in and log out.
- [ ] A tutor can create an availability slot for a future date.
- [ ] A student can browse available slots and book one.
- [ ] The booking is persisted and retrievable after page refresh.
- [ ] A duplicate booking attempt is rejected by the backend.
- [ ] A past-date slot creation is rejected by the backend.
- [ ] A student calling a tutor-only endpoint receives 403.
- [ ] Automated tests verify BR-01, BR-02, BR-03, and NFR-01.
- [ ] Code is merged to `main` via reviewed PRs on `sprint-1-staging`.

---

## 4. Sprint 2 — Core Expansion (Deliverable 2)

### Goal
Extend the booking platform with discovery/search capabilities, booking lifecycle management (cancellation), tutor slot management, and admin operational tools. Deploy the application to GCP with CI/CD.

### Features

| Feature ID | Feature | Requirements Covered |
|:---|:---|:---|
| **F-09** | Search & Filter Slots | FR-09 |
| **F-10** | Booking Cancellation & Slot Reversion | FR-10, BR-05 |
| **F-11** | Tutor Slot Edit / Delete | FR-11 |
| **F-12** | Admin Tutor & Subject Management | FR-12 |
| **F-13** | Docker Containerization & GCP Deployment | NFR-07 |
| **F-14** | CI/CD Pipeline (GitHub Actions) | NFR-06 |

### New Business Rules in Sprint 2
- **BR-05:** Cancellation time-window rule (>24h: slot reopens; <24h: slot stays cancelled).

### Dependencies
- Sprint 1 must be complete and merged to `main`.
- GCP project and Cloud SQL instance must be provisioned (Lab 5).
- Cross-team UAT feedback from Lab 6 must be triaged.

### Sprint 2 Exit Criteria
- [ ] Students can filter slots by subject, tutor, and date range.
- [ ] Students can cancel bookings with correct time-window enforcement.
- [ ] Tutors can delete/edit their own unbooked slots.
- [ ] Admin can manage tutor subjects.
- [ ] Application is deployed on GCP and accessible via public URL.
- [ ] GitHub Actions CI pipeline runs tests on every PR.
- [ ] At least one Lab 6 UAT defect is fixed and verified.
- [ ] Sprint 3 contracts (feature SDS, AC, STS) are complete.
- [ ] At least one Sprint 3 feature (F-15) is implemented and tested.

---

## 5. Sprint 3 — Completion & Hardening (Final Delivery)

### Goal
Complete remaining product features (session completion, student feedback, tutor ratings), harden test coverage, polish the UI, and deliver the final demonstration video.

### Features

| Feature ID | Feature | Requirements Covered |
|:---|:---|:---|
| **F-15** | Tutor Session Completion & Notes | FR-13 |
| **F-16** | Student Feedback & Rating | FR-14, BR-07 |
| **F-17** | Tutor Average Rating Display | FR-15 |
| **F-18** | Regression Test Suite & Quality Hardening | NFR-06 |

### New Business Rules in Sprint 3
- **BR-07:** One review per completed booking (unique constraint).

### Sprint 3 Exit Criteria
- [ ] Tutors can mark appointments as completed and enter lesson notes.
- [ ] Students can rate completed sessions (1–5 stars + text review).
- [ ] Tutor profiles display calculated average rating.
- [ ] Full regression test suite passes (all sprints).
- [ ] 4-minute demonstration video is recorded (both team members presenting).
- [ ] Final self-contained PDF is compiled and submitted.
- [ ] Code is merged to `main` and tagged (e.g., `v1.0.0-final`).

---

## 6. Feature-to-Sprint Allocation Summary

| Feature ID | Feature Name | Sprint 1 | Sprint 2 | Sprint 3 |
|:---|:---|:---:|:---:|:---:|
| F-01 | Authentication & Identity | ✅ | | |
| F-02 | Tutor Slot Creation | ✅ | | |
| F-03 | Student Slot Browsing | ✅ | | |
| F-04 | Student Booking Creation | ✅ | | |
| F-05 | Student Booking Retrieval | ✅ | | |
| F-06 | Tutor Appointment View | ✅ | | |
| F-07 | Admin Booking Overview | ✅ | | |
| F-08 | Database Seeding | ✅ | | |
| F-09 | Search & Filter Slots | | ✅ | |
| F-10 | Booking Cancellation | | ✅ | |
| F-11 | Tutor Slot Edit / Delete | | ✅ | |
| F-12 | Admin Tutor & Subject Mgmt | | ✅ | |
| F-13 | Docker & GCP Deployment | | ✅ | |
| F-14 | CI/CD Pipeline | | ✅ | |
| F-15 | Session Completion & Notes | | | ✅ |
| F-16 | Student Feedback & Rating | | | ✅ |
| F-17 | Tutor Average Rating | | | ✅ |
| F-18 | Regression & Hardening | | | ✅ |

---

## 7. Risk Mitigation

| Risk | Impact | Mitigation |
|:---|:---|:---|
| Final exam period (Dec 1–11) conflicts with Sprint 3 | Incomplete Sprint 3 features | Target 90% code completion by Nov 29 (Deliverable 2). Implement F-15 before Nov 29. Reserve Dec 12–13 weekend for F-16, F-17, video recording, and PDF compilation. |
| Prisma 8 RC instability | Migration or ORM bugs | Pin the exact Prisma version. Test migrations early. Have fallback to raw SQL if needed. |
| Cross-team UAT (Lab 6) produces many defects | Sprint 2 scope overrun | Triage defects immediately. Fix critical/high only; defer cosmetic issues to Sprint 3. |
| GCP deployment issues (Lab 5) | Deployment delay blocks Deliverable 2 | Start Docker containerization as early as Nov 9. Do not wait until the Lab 5 deadline. |

---

## 8. Team Responsibility Matrix

| Track | Partner 1 | Partner 2 |
|:---|:---|:---|
| **Sprint 1** | Auth API, Slot Creation, Frontend UI, SRS (Part A), Sprint Plan (Part D) | Booking API, Conflict Prevention, System SDS (Part C), Traceability (Part B) |
| **Sprint 2** | Search/Filter, Admin Dashboard, Docker/GCP Setup (Lab 5) | Cancellation Logic, Slot Edit/Delete, UAT Triage (Lab 6), Maintenance (Lab 7) |
| **Sprint 3** | Session Completion (F-15), Tutor Ratings (F-17) | Student Feedback (F-16), Regression Suite (F-18), Demo Video |
