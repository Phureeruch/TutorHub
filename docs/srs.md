# TutorHub
# Software Requirements Specification (SRS)

**Draft 2 – Revised Requirements (Post-Clarification)**  
**Revision 2.1 (Sprint 1 review):** per-subject hourly prices, teaching levels and topics (FR-05), and optional lecture-file attachments on bookings (§4.1, FR-08, BR-08) moved into scope.  
**Revision 2.2 (Lab 7 adaptive maintenance — `CHG-03`, Issue `#54`):** added 1-hour tutor availability publication notice and 8-hour daily teaching capacity limit (`FR-06`, `BR-04`), 2-hour advance student booking cutoff and 4-hour maximum single-booking duration cap (`FR-08`, `BR-05`), and 3-tier multi-hour bundle discount (`0%` for 1h, `5%` for 2h, `10%` for 3h–4h) on frozen booking `totalPrice` snapshots (`FR-10`, `BR-09`).  
**Revision 2.3 (Deliverable 2 Release Candidate baseline reconciliation — Issue `#44`):** integrated and verified F-16 (Tutor Lesson Completion & Homework Notes) workflow on top of Sprint 2 baseline, specified 1..2,000 character length bounds, tutor ownership validation, and post-completion cancellation rejection (`FR-13`, `BR-14`).

## 1. Introduction

### 1.1 Purpose
This document describes the functional and non-functional requirements of TutorHub. It defines the system features, business rules, and limitations to guide development and testing across all project deliverables.

### 1.2 Project Overview
TutorHub is a web-based tutoring platform that connects Students with Tutors. Students can find available tutoring sessions and book lessons. Tutors can manage their availability and view their appointments. Admins can manage users, subjects, and bookings.

### 1.3 Definitions
- **Student:** A user who searches for and books tutoring lessons.
- **Tutor:** A user who provides tutoring lessons.
- **Admin:** A user who manages the system.
- **Availability:** A time period when a Tutor is available to teach.
- **Booking:** A confirmed tutoring lesson.
- **Mock Payment:** A simulated payment process without real financial transactions.

## 2. Stakeholders

1. **Student:** Searches for Tutors, views available times, books lessons, manages bookings, and submits/edits reviews.
2. **Tutor:** Manages profile information, subjects, hourly rates, availability, and tutoring appointments.
3. **Admin:** Manages Tutor accounts, subjects, and system-wide booking information.

## 3. User Roles and Permissions

### 3.1 Student
- Register and log in.
- Complete mock email verification.
- Search for Tutors and available lessons.
- Book available time periods.
- View and cancel their own bookings.
- Submit and edit reviews for completed lessons.

### 3.2 Tutor
- Log in using an Admin-created or approved account.
- Manage profile and teaching information.
- Select subjects and set hourly prices.
- Create and manage availability periods.
- View their own appointments.
- Cancel bookings when necessary.
- Mark lessons as completed and add lesson notes/homework.

### 3.3 Admin
- Log in using an authorized Admin account.
- Create or approve Tutor accounts.
- Manage the master subject list.
- View system-wide bookings.
- Manage Tutor and Student account status when necessary.

Each account has only one role: Student, Tutor, or Admin.

## 4. Product Scope

### 4.1 In Scope

TutorHub includes:

1. User registration, login, logout, and role-based access.
2. Mock email verification and mock password reset.
3. Tutor profile, subject, and hourly price management.
4. Tutor availability management (continuous time periods with interval merging).
5. Student Tutor discovery and availability browsing.
6. Booking creation with partial availability booking and conflict prevention.
7. Mock payment, atomic confirmation, and booking price snapshots.
8. Booking retrieval and cancellation.
9. Automatic refund calculation based on a 3-tier refund policy.
10. Lesson completion and lesson notes.
11. Student reviews and editable ratings.
12. Basic Admin management of accounts, subjects, and bookings.
13. Optional lecture-file attachments on a booking (up to 5 files, at most 20 MB each; PDF, PowerPoint, Word, plain text, or image files), visible only to the booking's Student, Tutor, and Admin.
14. Per-subject teaching information: each subject a Tutor teaches has its own hourly price, teaching levels (High school, Undergraduate, Graduate), and an optional short topics description.

### 4.2 Out of Scope

The following features are not included in the current project scope:

- Real payment gateway and real money transactions.
- Tutor withdrawal and payout processing.
- Temporary Reservation and reservation expiration (no checkout hold timers).
- File attachments other than optional lecture files on a booking (e.g. attachments on reviews, chat, or profiles), file previews, and virus scanning.
- No-show reporting and dispute management.
- Video calling and live chat.
- Email, SMS, and push notifications.
- Tutor reply to reviews.
- Advanced review moderation and history management.
- Advanced analytics and revenue reports.
- Study-room or coworking-space booking.

## 5. Functional Requirements

### 5.1 Account and Authentication

**FR-01: User Authentication**  
The system shall allow Student, Tutor, and Admin users to log in and log out.

**FR-02: Registration and Account Management**  
The system shall allow Students to register. Tutor accounts shall be created or approved by Admin. Admin accounts shall be created by authorized system administration.

**FR-03: Role-Based Access**  
The system shall identify the current user's role and restrict access to functions and data according to that role.

**FR-04: Account Verification and Password Reset**  
The system shall provide mock email verification for Students and a mock password reset process.

### 5.2 Tutor and Availability Management

**FR-05: Tutor Profile and Subject Management**  
Tutors shall be able to manage their profile, teaching information, selected subjects, and hourly prices. Hourly prices are set per subject. For each subject, a Tutor may also state the teaching levels they teach it at (High school, Undergraduate, Graduate) and a short description of the topics covered (at most 200 characters). Admin shall be able to manage the available subject list.

**FR-06: Tutor Availability Management**  
Tutors shall be able to create, view, update, and remove their available time periods according to the booking status, subject to a minimum 1-hour advance publication notice and an 8-hour maximum daily teaching capacity per local calendar day (`Asia/Bangkok`).

**FR-07: Student Tutor Discovery**  
Students shall be able to select a subject and search for available Tutors by time, or select a Tutor and view their available times.

### 5.3 Booking and Payment

**FR-08: Booking Creation**  
Students shall be able to book an available time period at least 2 hours prior to the lesson start time by selecting a Tutor, subject, start time (aligned to 1-hour intervals starting at :00 or :30), and lesson duration of 1 to 4 whole hours. Students may optionally add notes and attach up to 5 lecture files (at most 20 MB each; PDF, PowerPoint, Word, plain text, or image files) for the Tutor to review before the lesson.

**FR-09: Booking Conflict Prevention**  
The system shall check availability and prevent overlapping bookings for the same Tutor or the same Student.

**FR-10: Mock Payment and Price Records**  
The system shall simulate payment, apply the multi-hour bundle discount tier (0% for 1h, 5% for 2h, 10% for 3h–4h), and store the payment result, base hourly price snapshot, and discounted total price snapshot. The recorded price snapshot shall remain unchanged if the Tutor changes their hourly price later.

**FR-11: Booking Information**  
Students shall be able to view their own bookings. Tutors shall be able to view appointments related to their lessons. Admin shall be able to view all bookings.

### 5.4 Cancellation and Lesson Management

**FR-12: Booking Cancellation and Refund**  
Students and Tutors shall be able to cancel bookings. The system shall calculate refunds automatically according to the business rules.

**FR-13: Lesson Completion**  
The assigned Tutor shall be able to mark a CONFIRMED lesson as completed and add a lesson summary or homework notes (1 to 2,000 characters). The recorded lesson summary shall be persisted and visible to the Student, Tutor, and Admin.

### 5.5 Reviews and Ratings

**FR-14: Student Reviews**  
Students shall be able to submit a rating and written review for a completed booking. Students shall be able to edit their existing review.

**FR-15: Tutor Rating Display**  
The system shall calculate and display the average rating of each Tutor based on submitted reviews.

## 6. Business Rules

**BR-01: User Roles**  
The system shall support only STUDENT, TUTOR, and ADMIN roles. Each account shall have only one role.

**BR-02: Account Creation and Verification**  
Students may register themselves but must complete mock email verification before booking. Tutor accounts require Admin creation or approval. Admin accounts require authorized creation.

**BR-03: Access Permissions**  
Users may access only the functions and information permitted by their roles and ownership.

**BR-04: Availability Duration, Lead-Time and Daily Capacity**  
A Tutor availability period must be between 1 and 8 whole hours long, start on the hour (:00) or half-hour (:30), and begin at least 1 hour (60 minutes) in the future at the time of creation or update. Across any single local calendar day (`Asia/Bangkok`, `UTC+7`), a Tutor's combined open availability hours and non-cancelled booked lesson hours must not exceed 8 hours.

**BR-05: Booking Time, Alignment, Cutoff and Max Duration (No Dead Fragments)**  
Booking start times must follow 1-hour intervals (e.g., 09:00, 10:00... or 09:30, 10:30, 11:30...) aligned with the availability period start, beginning on the hour (:00) or half-hour (:30), and must be scheduled at least 2 hours (120 minutes) in advance of the current time (`startTime - now >= 2 hours`). A single booking duration must be a whole number of hours between 1 and 4 hours inclusive (`1 <= durationHours <= 4`). This ensures that all bookings and any remaining availability segments remain in whole-hour increments, preventing unbookable fractional fragments and schedule monopolization.

**BR-06: Availability and Partial Booking**  
A booking must fit entirely within one Tutor availability period. A Student may book part of an availability period, and the remaining available time may still be booked by other students in whole-hour increments.

**BR-07: Booking Conflict Prevention**  
The system must prevent overlapping confirmed bookings for the same Tutor or the same Student, regardless of Tutor identity.

**BR-08: Booking Confirmation and Atomic Consistency**  
A booking shall be confirmed only after the mock payment succeeds and the system successfully verifies that the selected time is still available. The availability check, mock payment, and booking confirmation must execute within an atomic transaction. If the selected time is no longer available (e.g., due to a concurrent booking confirmation), the mock payment and booking creation must be atomically rolled back, preventing double booking and ensuring no payment record is persisted for a failed booking. Any lecture files attached to the booking are linked to it inside the same transaction, so a failed booking leaves no files linked to it.

**BR-09: Price Snapshot and Multi-Hour Bundle Discount**  
When a booking is confirmed, the system shall snapshot the chosen subject's base `hourlyPriceSnapshot` and compute the frozen `totalPrice` (`Decimal(10, 2)`) using a 3-tier multi-hour bundle discount: **1 hour = 0% discount** (`hourlyPrice * 1`), **2 hours = 5% discount** (`round2(hourlyPrice * 2 * 0.95)`), and **3 to 4 hours = 10% discount** (`round2(hourlyPrice * durationHours * 0.90)`). Later tutor price changes shall not affect existing bookings, and any subsequent cancellation refund (`BR-11`, `BR-12`) shall be calculated from the frozen discounted `totalPrice`.

**BR-10: Confirmed Booking Changes**  
A confirmed booking cannot change its Tutor, subject, date, start time, or duration. The Student must cancel and create a new booking instead.

**BR-11: Student Cancellation Refund**  
A Student may cancel a confirmed booking only prior to the scheduled lesson start time. The refund amount is calculated based on the time remaining until the lesson start time:
- **At least 72 hours before the lesson:** 100% refund.
- **Between 24 and 72 hours before the lesson (less than 72 hours and at least 24 hours):** 50% refund.
- **Within 24 hours of the lesson (less than 24 hours):** 0% refund.
- *Boundary Conditions:* Exactly 72 hours before the lesson qualifies for a 100% refund. Exactly 24 hours before the lesson qualifies for a 50% refund.

**BR-12: Tutor Cancellation**  
A Tutor may cancel a confirmed booking only prior to the scheduled lesson start time. When a Tutor cancels a confirmed booking, the Student shall receive a 100% refund regardless of time remaining. The cancelled time period shall remain blocked and shall not become available for other Students to book.

**BR-13: Availability Restoration and Interval Merging**  
When a Student cancels a booking, the released time period is restored to available status and automatically merged with any adjacent available time periods for the same Tutor, reconstructing a continuous availability block (e.g., a released 1-hour block between two 1-hour blocks merges back into a single 3-hour availability block). Time periods cancelled by a Tutor (BR-12) remain blocked and are never restored or merged.

**BR-14: Lesson Completion, Non-Cancellability and Reviews**  
Only the assigned Tutor may mark a CONFIRMED booking as COMPLETED while providing a non-empty lesson summary / homework note between 1 and 2,000 characters. Once marked COMPLETED, the booking is permanently non-cancellable by either Student or Tutor (subsequent cancellation attempts are rejected with 409 Conflict). Students may review only completed bookings. Each booking may have only one review, which the Student may edit.

**BR-15: Historical Records**  
The system shall retain relevant booking, payment, cancellation, and refund records for audit and reference purposes.

## 7. Non-Functional Requirements

**NFR-01: Security**  
The backend shall verify authentication and authorization for protected operations. Passwords shall be stored as secure salted hashes (e.g., bcrypt).

**NFR-02: Data Privacy**  
Students and Tutors shall only access booking information they are authorized to view. Admin may access system-wide booking information.

**NFR-03: Data Persistence**  
The system shall store application data in PostgreSQL. Data shall remain available after the application restarts.

**NFR-04: Data Integrity and Transactional Atomicity**  
The system shall prevent invalid or conflicting bookings under concurrent requests. Booking confirmation and mock payment must execute in an atomic transaction; concurrent conflict failures must roll back atomically without partial state changes.

**NFR-05: Testing and Maintainability**  
The system shall include automated tests for booking, cancellation, access-control, and refund rules. The project shall provide setup instructions and database migrations.

## 8. Assumptions and Constraints

1. TutorHub is designed for one school or institution.
2. Student email verification is simulated. No real email service is required.
3. Payment is simulated. No real payment gateway or money transfer is included.
4. Tutor and Admin accounts are not available through public self-registration.
5. Tutors manage their own availability and hourly prices.
6. All system date and time operations use a consistent time zone.
7. Booking duration is measured in whole hours, and start times follow 1-hour intervals starting on the hour (:00) or half-hour (:30), aligned with the tutor's availability period.
8. The system is a web application and requires an internet connection.
9. The project scope is limited by the three-sprint development schedule.

## 9. Seed Data

The system shall provide sample data for development and testing.

### 9.1 Sample Users

| Name | Role | Account |
|---|---|---|
| Alice | Tutor | Seed account |
| Bob | Tutor | Seed account |
| Charlie | Student | Seed account |
| Diana | Student | Seed account |
| Admin User | Admin | Seed account |

All sample accounts shall use development-only credentials. Passwords must be stored as hashes in the database.

### 9.2 Sample Availability and Booking Data

The database shall include sample Tutor availability for subjects such as Python Basics, Data Structures, Calculus I, and Linear Algebra.

Sample bookings shall be provided to test:
- Successful booking with price snapshot.
- Partial booking of an availability period without dead fragments.
- Overlapping booking prevention and atomic rollback under race conditions.
- Student and Tutor booking retrieval.
- Cancellation and 3-tier refund calculation ($\ge 72\text{h}$, $24\text{h} \le t < 72\text{h}$, $< 24\text{h}$).
- Interval merging upon Student cancellation.
- Lesson completion, review submission, and review editing.

Seed data shall be updated to match the final database design and business rules.
