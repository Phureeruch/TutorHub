/*
  Warnings:

  - You are about to drop the column `priceAtBooking` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `slotId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the `TutorSlot` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `durationHours` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endTime` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hourlyPriceSnapshot` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subjectId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPrice` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tutorId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'REFUNDED_PARTIAL', 'REFUNDED_FULL');

-- CreateEnum
CREATE TYPE "TeachingLevel" AS ENUM ('HIGH_SCHOOL', 'UNDERGRADUATE', 'GRADUATE');

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_slotId_fkey";

-- DropForeignKey
ALTER TABLE "TutorSlot" DROP CONSTRAINT "TutorSlot_tutorId_fkey";

-- DropIndex
DROP INDEX "Booking_studentId_status_idx";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "priceAtBooking",
DROP COLUMN "slotId",
ADD COLUMN     "cancelledBy" "Role",
ADD COLUMN     "durationHours" INTEGER NOT NULL,
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "hourlyPriceSnapshot" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "lessonSummary" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "subjectId" INTEGER NOT NULL,
ADD COLUMN     "totalPrice" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "tutorId" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "User"
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "TutorSlot";

-- DropEnum
DROP TYPE "SlotStatus";

-- CreateTable
CREATE TABLE "Subject" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorSubject" (
    "id" SERIAL NOT NULL,
    "tutorProfileId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "hourlyPrice" DECIMAL(10,2) NOT NULL,
    "levels" "TeachingLevel"[] DEFAULT ARRAY[]::"TeachingLevel"[],
    "topics" VARCHAR(200),

    CONSTRAINT "TutorSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" SERIAL NOT NULL,
    "tutorId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAttachment" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER,
    "uploadedById" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TutorProfile_userId_key" ON "TutorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TutorSubject_tutorProfileId_subjectId_key" ON "TutorSubject"("tutorProfileId", "subjectId");

-- CreateIndex
CREATE INDEX "Availability_tutorId_startTime_endTime_idx" ON "Availability"("tutorId", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAttachment_storageKey_key" ON "BookingAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "BookingAttachment_bookingId_idx" ON "BookingAttachment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingAttachment_uploadedById_bookingId_idx" ON "BookingAttachment"("uploadedById", "bookingId");

-- CreateIndex
CREATE INDEX "Booking_studentId_startTime_endTime_idx" ON "Booking"("studentId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Booking_tutorId_startTime_endTime_idx" ON "Booking"("tutorId", "startTime", "endTime");

-- AddForeignKey
ALTER TABLE "TutorProfile" ADD CONSTRAINT "TutorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorSubject" ADD CONSTRAINT "TutorSubject_tutorProfileId_fkey" FOREIGN KEY ("tutorProfileId") REFERENCES "TutorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorSubject" ADD CONSTRAINT "TutorSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAttachment" ADD CONSTRAINT "BookingAttachment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAttachment" ADD CONSTRAINT "BookingAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Enable GiST support for equality checks on integer columns
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent overlapping bookings for the same tutor
ALTER TABLE "Booking"
ADD CONSTRAINT booking_tutor_no_overlap
EXCLUDE USING gist (
    "tutorId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
)
WHERE ("status" <> 'CANCELLED');

-- Prevent overlapping bookings for the same student
ALTER TABLE "Booking"
ADD CONSTRAINT booking_student_no_overlap
EXCLUDE USING gist (
    "studentId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
)
WHERE ("status" <> 'CANCELLED');
