# TutorHub — Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose
This document defines the functional requirements, business rules, non-functional requirements, and project scope for **TutorHub**, a web-based tutoring and scheduling management platform. It serves as the authoritative reference for all design, implementation, and verification activities across the three-sprint delivery plan.

### 1.2 Project Context
A tutoring school provides private tutoring sessions through registered tutors. Currently, scheduling is handled manually via messages and spreadsheets, leading to double bookings, inconsistent information, and limited visibility for both students and staff. TutorHub replaces this with a centralized web platform.

### 1.3 Document Conventions
- **FR-xx** — Functional Requirement
- **BR-xx** — Business Rule
- **NFR-xx** — Non-Functional Requirement
- All IDs are stable and must not be renumbered across sprints.

---

## 2. Stakeholders

| Stakeholder | Interest and Needs |
|:---|:---|
| **Students** | Find tutors by subject and availability, understand lesson prices, and make or review bookings. |
| **Tutors** | Set teaching availability, manage their own schedules, and view their assigned appointments. |
| **Admin / School Owner** | Manage the tutoring operation, oversee tutors and bookings, and maintain accurate business information. |

---

## 3. System Actors and Responsibilities

TutorHub defines exactly **three** system roles. Each account is assigned one and only one role.

### 3.1 Student
Students are the customers who use the platform to arrange tutoring sessions.

- Log in and access their own account.
- Browse available tutors and the subjects they teach.
- View available lesson times and applicable prices.
- Book an available tutoring session (with optional session notes).
- View their own booking details and booking status.
- Cannot create availability slots or access other students' private booking details.

### 3.2 Tutor
Tutors provide tutoring services and manage their own teaching schedules.

- Log in and access their own account.
- View and manage their own tutor profile and teaching information.
- Create, update, or remove their available teaching time slots.
- View their own upcoming and past appointments (including student name and topic).
- Cannot book slots, access other tutors' schedules, or view admin-only data.

### 3.3 Admin
Admin represents the tutoring school owner or authorized platform administrator.

- Log in to the administrative area.
- Manage tutor information and subject assignments.
- View and oversee all student bookings across the school.
- Maintain accurate tutor and booking information.
- Ensure the platform operates according to the school's scheduling and booking rules.

---

## 4. Product Scope

### 4.1 In Scope (Full Product — Sprints 1–3)
- User authentication and role-based access control.
- Tutor profile and subject management.
- Tutor availability slot management (create, update, remove).
- Tutor discovery and search (filter by subject, tutor, date).
- Tutoring appointment booking, retrieval, and validation.
- Booking lifecycle management (cancellation and status transitions).
- Session completion tracking and lesson notes.
- Student feedback and tutor ratings.
- Administrative dashboard with booking oversight.

### 4.2 Out of Scope
The following features are explicitly excluded from all three sprints:

- Study-room, coworking-space, and desk reservations.
- Real payment gateway integration (prices are displayed but no real transactions).
- Automatic cancellation-fee calculation.
- Tutor ratings and reviews (moved to Sprint 3, reviews only — no financial incentive).
- Lesson packages and membership plans.
- Public tutor registration or self-service account creation (seeded accounts only).
- Advanced business analytics and revenue reports.
- Email, SMS, or push notifications.
- Live video calling or real-time chat.

---

## 5. Functional Requirements

| ID | Description | Sprint |
|:---|:---|:---:|
| **FR-01** | The system shall allow users (Student, Tutor, Admin) to log in with a valid email and password, receive an authentication token (JWT), and log out by invalidating their session. | 1 |
| **FR-02** | The system shall identify the currently authenticated user and their assigned role on every protected API request. | 1 |
| **FR-03** | A Tutor shall be able to create an availability slot specifying a subject, start time, end time, and price. | 1 |
| **FR-04** | A Student shall be able to browse all currently available (status = `AVAILABLE`) slots from all tutors, showing tutor name, subject, date/time, and price. | 1 |
| **FR-05** | A Student shall be able to book an available slot by providing the slot ID and optional session notes. Upon successful booking, the slot status changes to `BOOKED`. | 1 |
| **FR-06** | A Student shall be able to view a list of their own bookings (upcoming and past), including subject, tutor name, date/time, status, and their submitted notes. | 1 |
| **FR-07** | A Tutor shall be able to view their own scheduled appointments, including the student's name, subject, date/time, and student's session notes. | 1 |
| **FR-08** | An Admin shall be able to view a global list of all bookings across the school, including student name, tutor name, subject, date/time, and booking status. | 1 |
| **FR-09** | A Student shall be able to search and filter available slots by subject, tutor name, and/or date range. | 2 |
| **FR-10** | A Student shall be able to cancel a confirmed booking. The system applies the cancellation time-window rule (see BR-05). | 2 |
| **FR-11** | A Tutor shall be able to delete or edit their own unbooked (status = `AVAILABLE`) slots. | 2 |
| **FR-12** | An Admin shall be able to manage tutor information, including assigning or updating the subjects a tutor teaches. | 2 |
| **FR-13** | A Tutor shall be able to mark a completed appointment as `COMPLETED` and enter lesson notes or homework assigned. | 3 |
| **FR-14** | A Student shall be able to rate a completed session (1–5 stars) and submit a written review. | 3 |
| **FR-15** | The system shall calculate and display each tutor's average rating on their profile based on submitted student reviews. | 3 |

---

## 6. Business Rules

| ID | Rule | Enforcement | Sprint |
|:---|:---|:---|:---:|
| **BR-01** | **Slot Exclusivity:** A single availability slot can be booked by at most one student. Once booked, subsequent booking attempts for the same slot must be rejected. | Backend — UNIQUE constraint on `bookings.slot_id` + HTTP `409 Conflict` response. | 1 |
| **BR-02** | **No Past Slots:** An availability slot cannot be created with a `start_time` in the past. A booking cannot be created for a slot whose `start_time` has already passed. | Backend — validation check, HTTP `400 Bad Request`. | 1 |
| **BR-03** | **Role Segregation:** Only users with the `TUTOR` role can create, update, or delete availability slots. Only users with the `STUDENT` role can create bookings. | Backend — role-based middleware, HTTP `403 Forbidden`. | 1 |
| **BR-04** | **Single Role per Account:** Each user account has exactly one assigned role (`STUDENT`, `TUTOR`, or `ADMIN`). Roles do not change at runtime. | Database — `role` column with CHECK constraint. | 1 |
| **BR-05** | **Cancellation Time Window:** A student may cancel a booking more than 24 hours before the slot's `start_time`. If cancelled within 24 hours, the booking is cancelled but the slot is not reopened (`CANCELLED` status). If cancelled with >24h notice, the slot reverts to `AVAILABLE`. | Backend — time comparison logic. | 2 |
| **BR-06** | **End After Start:** A slot's `end_time` must be strictly after its `start_time`. | Backend + Database — CHECK constraint. | 1 |
| **BR-07** | **One Review per Session:** A student may submit at most one review per completed booking. | Backend — unique constraint on `(booking_id, student_id)`. | 3 |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement | Sprint |
|:---|:---|:---|:---:|
| **NFR-01** | **Security — Authorization** | All API endpoints must enforce role and resource-ownership checks on the server. Unauthenticated requests return HTTP `401 Unauthorized`. Unauthorized role access returns HTTP `403 Forbidden`. Frontend-only restrictions are insufficient. | 1 |
| **NFR-02** | **Security — Data Privacy** | A Student cannot retrieve the booking details, notes, or personal information of another student. A Tutor cannot view another tutor's appointment details. Responses must filter records to only those belonging to the requesting user. | 1 |
| **NFR-03** | **Security — Password Storage** | User passwords must be hashed using a salted cryptographic algorithm (e.g., bcrypt) before storage. Plaintext passwords must never be persisted or logged. | 1 |
| **NFR-04** | **Persistence** | All data (users, slots, bookings) must be persisted in a PostgreSQL database. Data must survive application restart. | 1 |
| **NFR-05** | **Reproducibility** | The application must be reproducible on a new machine using documented setup instructions, including database migrations/schema push and seed data. | 1 |
| **NFR-06** | **Testability** | Important business rules (BR-01 through BR-06) and access control rules (NFR-01, NFR-02) must be verifiable by automated tests (unit and/or integration). | 1 |
| **NFR-07** | **Containerization** | The application must be containerizable with Docker and deployable to Google Cloud Platform (GCP). | 2 |

---

## 8. Assumptions

1. Sprint 1 will use **seeded test accounts** (pre-created in the database) rather than public self-registration.
2. Tutors are registered and managed by the tutoring school — this is not an open marketplace.
3. Prices are displayed for information purposes; no real payment transaction occurs.
4. All timestamps are stored and compared in a single consistent timezone (server-local or UTC).
5. The system supports a single tutoring school (single-tenant). Multi-school / multi-tenant operation is out of scope.
6. The initial subject list is managed through tutor slot creation (free text) in Sprint 1, with admin-managed subject assignments added in Sprint 2.

---

## 9. Seed Data (Sprint 1 Testing & Demonstration)

The following accounts are pre-seeded for development, TA grading, and cross-team UAT:

| Email | Password | Role | Full Name |
|:---|:---|:---|:---|
| `alice@tutorhub.com` | `password123` | TUTOR | Alice Johnson |
| `bob@tutorhub.com` | `password123` | TUTOR | Bob Smith |
| `charlie@tutorhub.com` | `password123` | STUDENT | Charlie Wong |
| `diana@tutorhub.com` | `password123` | STUDENT | Diana Lee |
| `admin@tutorhub.com` | `password123` | ADMIN | Admin User |

### Pre-Seeded Availability Slots

| Tutor | Subject | Date | Time | Price (฿) | Status |
|:---|:---|:---|:---|:---|:---|
| Alice Johnson | Python Basics | Nov 10, 2026 | 10:00–11:00 | 500 | AVAILABLE |
| Alice Johnson | Python Basics | Nov 11, 2026 | 10:00–11:00 | 500 | AVAILABLE |
| Alice Johnson | Data Structures | Nov 12, 2026 | 13:00–14:00 | 600 | AVAILABLE |
| Bob Smith | Calculus I | Nov 10, 2026 | 14:00–15:00 | 600 | AVAILABLE |
| Bob Smith | Linear Algebra | Nov 11, 2026 | 14:00–15:00 | 550 | AVAILABLE |

### Pre-Seeded Booking (for demonstration)

| Student | Slot | Status |
|:---|:---|:---|
| Charlie Wong | Alice → Python Basics, Nov 10, 10:00–11:00 | CONFIRMED |
