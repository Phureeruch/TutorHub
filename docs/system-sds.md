# System Design Specification (SDS) - TutorHub

## 1. Architecture Overview
TutorHub utilizes a modern Client-Server architecture to separate concerns and ensure scalability:
*   **Frontend (Client):** React 18, TypeScript, Vite, Bootstrap. Communicates via RESTful JSON APIs.
*   **Backend (Server):** Node.js, Express.js. Handles business logic, role-based access control, and transaction safety.
*   **Database:** PostgreSQL managed via Prisma ORM for type-safe database schema and querying.

## 2. Database Schema (Prisma)
The following schema enforces core Sprint 1 constraints directly at the database level.

```prisma
enum Role { STUDENT, TUTOR, ADMIN }
enum SlotStatus { AVAILABLE, BOOKED, CANCELLED }
enum BookingStatus { CONFIRMED, CANCELLED, COMPLETED }

model User {
  id        Int         @id @default(autoincrement())
  email     String      @unique
  password  String      // NFR-03: Must be hashed (e.g., bcrypt)
  name      String
  role      Role        // BR-04: Single Role per account
  slots     TutorSlot[] @relation("TutorSlots")
  bookings  Booking[]   @relation("StudentBookings")
}

model TutorSlot {
  id        Int         @id @default(autoincrement())
  tutorId   Int
  tutor     User        @relation("TutorSlots", fields: [tutorId], references: [id])
  subject   String
  startTime DateTime
  endTime   DateTime    // BR-06: End time must be after start time
  price     Float
  status    SlotStatus  @default(AVAILABLE)
  booking   Booking?
}

model Booking {
  id        Int           @id @default(autoincrement())
  studentId Int
  student   User          @relation("StudentBookings", fields: [studentId], references: [id])
  slotId    Int           @unique // BR-01: Exclusivity (Prevents double booking)
  slot      TutorSlot     @relation(fields: [slotId], references: [id])
  notes     String?
  status    BookingStatus @default(CONFIRMED)
  createdAt DateTime      @default(now())
}
```

## 3. Sprint 1 API Specifications

### 3.1 Auth API (Korapin)
*   **POST** `/api/auth/login`
    *   *Request:* `{ email, password }`
    *   *Response (200):* `{ token, role, name }`

### 3.2 Tutor Slots API (Korapin)
*   **POST** `/api/slots` (Requires: TUTOR)
    *   *Request:* `{ subject, startTime, endTime, price }`
    *   *Response (201):* Created slot. Returns 400 if `startTime` is in the past (BR-02).
*   **GET** `/api/slots` (Requires: Auth)
    *   *Response (200):* Returns list of slots.

### 3.3 Booking API (Phureeruch)
*   **POST** `/api/bookings` (Requires: STUDENT)
    *   *Request:* `{ slotId, notes }`
    *   *Response (201):* Booking confirmed successfully.
    *   *Errors:* `409 Conflict` (BR-01 Double booking), `400 Bad Request` (BR-02 Past slot).
*   **GET** `/api/bookings` (Requires: Auth)
    *   *Response (200):* Returns bookings. Applies NFR-02 data privacy rules.

