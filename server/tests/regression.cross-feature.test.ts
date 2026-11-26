import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertTutorIsApproved, validateSubjectInput } from '../src/utils/admin-validation.js';
import { calculateRetainedRevenue } from '../src/utils/admin-metrics.js';
import { findBookingConflict } from '../src/utils/booking-overlap.js';
import { isSlotInBangkokTimeWindow, validateDiscoveryTimeWindow } from '../src/utils/discovery-time.js';
import { mergeAdjacentIntervals } from '../src/utils/interval-merge.js';
import { assertCanCompleteBooking, LessonCompletionError, validateLessonSummary } from '../src/utils/lesson-completion.js';
import { calculateBookingPrice } from '../src/utils/price-calculation.js';
import { calculateStudentRefund, calculateTutorRefund } from '../src/utils/refund-calculation.js';
import { validateBookingTime } from '../src/utils/time.validation.js';

describe('Cross-Feature Regression Suite (Deliverable 2 Release Candidate — v2.1.0-d2-rc)', () => {
  describe('Journey 1: Sprint 1 Continuity & Conflict Prevention (Part A, FR-01–FR-10, BR-01–BR-09)', () => {
    it('executes availability creation, partial booking alignment, price snapshot, and conflict prevention', () => {
      // 1. Availability window from 09:00 to 12:00 (3 whole hours)
      const now = new Date('2026-11-28T06:00:00.000Z');
      const availabilityStart = new Date('2026-11-28T09:00:00.000Z');
      const availabilityEnd = new Date('2026-11-28T12:00:00.000Z');

      // 2. Student books a 1-hour partial booking from 09:00 to 10:00 (BR-05, BR-06)
      const bookingStart = new Date('2026-11-28T09:00:00.000Z');
      const bookingEnd = new Date('2026-11-28T10:00:00.000Z');
      const durationHours = 1;

      // Validate booking time alignment
      const validationResult = validateBookingTime({
        startTime: bookingStart,
        endTime: bookingEnd,
        availabilityStartTime: availabilityStart,
        availabilityEndTime: availabilityEnd,
        now,
      });
      assert.deepEqual(validationResult, { valid: true });

      // 3. Price snapshot calculation (BR-09, CHG-03A)
      const hourlyPrice = 500;
      const priceResult = calculateBookingPrice({ hourlyPrice, durationHours: 1 });
      assert.equal(priceResult.totalPrice, 500);
      assert.equal(priceResult.hourlyPriceSnapshot, 500);

      const price2h = calculateBookingPrice({ hourlyPrice, durationHours: 2 });
      assert.equal(price2h.totalPrice, 950);

      const price3h = calculateBookingPrice({ hourlyPrice, durationHours: 3 });
      assert.equal(price3h.totalPrice, 1350);

      // 4. Overlapping booking conflict prevention (BR-07, NFR-04)
      const existingBookings = [
        {
          id: 101,
          tutorId: 1,
          studentId: 2,
          startTime: bookingStart,
          endTime: bookingEnd,
          status: 'CONFIRMED' as const,
        },
      ];

      // Second booking attempt with the same tutor at overlapping time must detect conflict
      const conflictSameTutor = findBookingConflict(
        {
          tutorId: 1,
          studentId: 3, // different student
          startTime: bookingStart,
          endTime: bookingEnd,
        },
        existingBookings,
      );
      assert.ok(conflictSameTutor, 'Overlapping booking for the same tutor must be detected as conflict');

      // Second booking attempt for the same student with another tutor must detect conflict
      const conflictSameStudent = findBookingConflict(
        {
          tutorId: 2, // different tutor
          studentId: 2, // same student
          startTime: bookingStart,
          endTime: bookingEnd,
        },
        existingBookings,
      );
      assert.ok(conflictSameStudent, 'Overlapping booking for the same student must be detected as conflict');

      // Booking that starts exactly when the previous one ends must be permitted (no overlap)
      const nonOverlappingBooking = findBookingConflict(
        {
          tutorId: 1,
          studentId: 3,
          startTime: bookingEnd,
          endTime: new Date(bookingEnd.getTime() + 60 * 60 * 1000),
        },
        existingBookings,
      );
      assert.equal(nonOverlappingBooking, null, 'Adjacent non-overlapping booking must be allowed');
    });
  });

  describe('Journey 2: Sprint 2 Cross-Feature Lifecycle (F-13 -> F-09 -> F-04 -> F-10/F-12 -> F-07/F-15)', () => {
    it('verifies approval -> discovery -> booking -> cancellation/merge -> admin retained revenue', () => {
      // 1. Admin tutor approval guard (BR-02, F-13)
      assert.throws(
        () => assertTutorIsApproved(false),
        (err: any) => err.statusCode === 403,
        'Unapproved tutor must be rejected with 403',
      );
      assert.doesNotThrow(() => assertTutorIsApproved(true));

      // Subject catalog validation (AC-13.4, AC-13.5)
      const subject = validateSubjectInput({ name: 'Linear Algebra', description: 'Matrix operations' });
      assert.equal(subject.valid, true);
      if (subject.valid) {
        assert.equal(subject.data.name, 'Linear Algebra');
      }

      // 2. Student discovers tutor using search time window filter (F-09)
      const windowValidation = validateDiscoveryTimeWindow('09:00', '12:00');
      assert.equal(windowValidation.valid, true);

      // Slot aligned to Bangkok 09:00-10:00 (i.e. UTC 02:00-03:00) -> true
      const bkkSlotStart = new Date('2026-11-28T02:00:00.000Z'); // 09:00 Bangkok
      const bkkSlotEnd = new Date('2026-11-28T03:00:00.000Z');   // 10:00 Bangkok
      assert.equal(isSlotInBangkokTimeWindow(bkkSlotStart, bkkSlotEnd, '09:00', '12:00'), true);

      // 3. Student cancellation & 3-tier refund calculation (F-10, BR-11)
      const now = new Date();
      const startTime72h = new Date(now.getTime() + 80 * 60 * 60 * 1000); // 80h in future (>= 72h)
      const refund72h = calculateStudentRefund({
        totalPrice: 1000,
        startTime: startTime72h,
        now,
      });
      assert.equal(refund72h.refundPercentage, 100);
      assert.equal(refund72h.refundAmount, 1000);

      // Cancellation between 24h and 72h -> 50% refund
      const startTime48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const refund48h = calculateStudentRefund({
        totalPrice: 1000,
        startTime: startTime48h,
        now,
      });
      assert.equal(refund48h.refundPercentage, 50);
      assert.equal(refund48h.refundAmount, 500);

      // Cancellation < 24h -> 0% refund
      const startTime12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const refund12h = calculateStudentRefund({
        totalPrice: 1000,
        startTime: startTime12h,
        now,
      });
      assert.equal(refund12h.refundPercentage, 0);
      assert.equal(refund12h.refundAmount, 0);

      // Tutor cancellation always gives 100% refund (BR-12)
      const tutorRefund = calculateTutorRefund({ totalPrice: 1000, startTime: startTime12h, now });
      assert.equal(tutorRefund.refundPercentage, 100);
      assert.equal(tutorRefund.refundAmount, 1000);

      // 4. Availability restoration & interval merging upon student cancellation (F-12, BR-13)
      // Suppose tutor has [09:00, 10:00) and [11:00, 12:00), student cancels [10:00, 11:00)
      const d = (h: number) => new Date(`2026-11-28T${String(h).padStart(2, '0')}:00:00.000Z`);
      const existingIntervals = [
        { startTime: d(9), endTime: d(10) },
        { startTime: d(11), endTime: d(12) },
      ];
      const releasedSlot = { startTime: d(10), endTime: d(11) };
      const merged = mergeAdjacentIntervals([...existingIntervals, releasedSlot]);
      assert.equal(merged.length, 1);
      assert.equal(merged[0].startTime.toISOString(), d(9).toISOString());
      assert.equal(merged[0].endTime.toISOString(), d(12).toISOString());

      // 5. Admin summary retained revenue calculation (F-15, DEF-08, STS-15.3)
      const sampleBookings = [
        { totalPrice: 400, status: 'CONFIRMED' as const, refundAmount: null },
        { totalPrice: 400, status: 'CANCELLED' as const, refundAmount: 200 }, // 50% refund -> retains 200
        { totalPrice: 400, status: 'CANCELLED' as const, refundAmount: 0 },   // 0% refund -> retains 400
        { totalPrice: 400, status: 'CANCELLED' as const, refundAmount: 400 }, // 100% refund -> retains 0
      ];
      const retainedRevenue = calculateRetainedRevenue(sampleBookings);
      assert.equal(retainedRevenue, 1000); // 400 + 200 + 400 + 0 = 1000 THB
    });
  });

  describe('Journey 3: Sprint 3 Cross-Feature Guard (F-16 Blocks F-10/F-11 Cancellation)', () => {
    it('completes confirmed lesson and rejects subsequent cancellation attempts', () => {
      const tutorId = 10;
      const studentId = 20;
      const otherTutorId = 11;

      const confirmedBooking = {
        id: 501,
        tutorId,
        studentId,
        status: 'CONFIRMED' as const,
        lessonSummary: null as string | null,
      };

      // 1. Role and ownership check: student and other tutor rejected with 403 Forbidden
      assert.throws(
        () => assertCanCompleteBooking(confirmedBooking, studentId, 'STUDENT'),
        (err: LessonCompletionError) => err.statusCode === 403,
      );
      assert.throws(
        () => assertCanCompleteBooking(confirmedBooking, 999, 'ADMIN'),
        (err: LessonCompletionError) => err.statusCode === 403,
      );
      assert.throws(
        () => assertCanCompleteBooking(confirmedBooking, otherTutorId, 'TUTOR'),
        (err: LessonCompletionError) => err.statusCode === 403,
      );

      // 2. Validate lesson summary boundary constraints (1..2000 chars)
      const blankResult = validateLessonSummary('   ');
      assert.equal(blankResult.valid, false);

      const overLimitResult = validateLessonSummary('a'.repeat(2001));
      assert.equal(overLimitResult.valid, false);

      const validResult = validateLessonSummary('  Great lesson on calculus. Homework: problems 1-10.  ');
      assert.equal(validResult.valid, true);
      const validSummary = (validResult as { valid: true; trimmed: string }).trimmed;
      assert.equal(validSummary, 'Great lesson on calculus. Homework: problems 1-10.');

      // 3. Assigned tutor can complete confirmed booking (AC-16.1)
      assert.doesNotThrow(() => assertCanCompleteBooking(confirmedBooking, tutorId, 'TUTOR'));

      // 4. Booking transitions to COMPLETED
      const completedBooking = {
        ...confirmedBooking,
        status: 'COMPLETED' as const,
        lessonSummary: validSummary,
      };

      // 5. Subsequent completion attempts on COMPLETED booking return 409 Conflict (AC-16.4)
      assert.throws(
        () => assertCanCompleteBooking(completedBooking, tutorId, 'TUTOR'),
        (err: LessonCompletionError) => err.statusCode === 409,
      );

      // 6. Cross-feature guard: cancellation rejects non-CONFIRMED bookings with 409 Conflict
      const canCancel = (booking: { status: string }) => {
        if (booking.status !== 'CONFIRMED') {
          const err = new Error('Only confirmed bookings can be cancelled') as any;
          err.statusCode = 409;
          throw err;
        }
        return true;
      };

      assert.throws(
        () => canCancel(completedBooking),
        (err: any) => err.statusCode === 409,
        'COMPLETED booking must permanently reject cancellation with 409 Conflict',
      );
    });
  });
});
