# Requirements Traceability Matrix (Sprint 1)

| ID | Description | Implementation Component / API | Responsible |
|:---|:---|:---|:---|
| **FR-01** | User Login / Logout | `POST /api/auth/login` | Korapin |
| **FR-02** | Identify user role | `authMiddleware` (Express JWT) | Korapin |
| **FR-03** | Tutor create slot | `POST /api/slots` | Korapin |
| **FR-04** | Student browse slots | `GET /api/slots` | Korapin |
| **FR-05** | Student book slot | `POST /api/bookings` | Phureeruch |
| **FR-06** | Student view bookings | `GET /api/bookings` | Phureeruch |
| **FR-07** | Tutor view appointments| `GET /api/slots` (Filtered) | Korapin |
| **FR-08** | Admin view all bookings| `GET /api/admin/bookings` | Phureeruch |
| **BR-01** | Slot Exclusivity | Prisma `@unique` on `slotId` | Phureeruch |
| **BR-02** | No Past Slots | Validations in `POST /api/slots` and `bookings` | Korapin & Phureeruch |
| **BR-03** | Role Segregation | `roleMiddleware` (Express) | Korapin |
| **BR-04** | Single Role per Account| `schema.prisma` (`Role` Enum) | Phureeruch |
| **BR-06** | End time after start time| `POST /api/slots` Validation | Korapin |
| **NFR-01**| Server-side Authorization| Express Middleware | Korapin |
| **NFR-02**| Data Privacy | `GET /api/bookings` (Filter by ID) | Phureeruch |
| **NFR-03**| Password Hashing | Auth logic (bcrypt) | Korapin |
| **NFR-04**| DB Persistence | PostgreSQL + Prisma ORM | Phureeruch |

