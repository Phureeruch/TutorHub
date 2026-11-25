import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateLessonSummary,
  assertCanCompleteBooking,
} from '../src/utils/lesson-completion.js';

describe('validateLessonSummary (FR-13, BR-14, AC-16.3, STS-16.2)', () => {
  it('accepts valid lesson summary string and trims leading/trailing whitespace', () => {
    const result = validateLessonSummary('  Covered binary search trees and recursion.  ');
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.trimmed, 'Covered binary search trees and recursion.');
    }
  });

  it('accepts summary of exact boundary length (1 char and 2000 chars)', () => {
    const minResult = validateLessonSummary('A');
    assert.equal(minResult.valid, true);
    if (minResult.valid) {
      assert.equal(minResult.trimmed, 'A');
    }

    const maxResult = validateLessonSummary('X'.repeat(2000));
    assert.equal(maxResult.valid, true);
    if (maxResult.valid) {
      assert.equal(maxResult.trimmed.length, 2000);
    }
  });

  it('rejects missing, null, undefined, or non-string summary with 400', () => {
    assert.deepEqual(validateLessonSummary(undefined), {
      valid: false,
      reason: 'Enter a lesson summary or homework note.',
    });
    assert.deepEqual(validateLessonSummary(null), {
      valid: false,
      reason: 'Enter a lesson summary or homework note.',
    });
    assert.deepEqual(validateLessonSummary(12345), {
      valid: false,
      reason: 'Enter a lesson summary or homework note.',
    });
  });

  it('rejects blank or whitespace-only summary with 400', () => {
    assert.deepEqual(validateLessonSummary(''), {
      valid: false,
      reason: 'Enter a lesson summary or homework note.',
    });
    assert.deepEqual(validateLessonSummary('    \n\t   '), {
      valid: false,
      reason: 'Enter a lesson summary or homework note.',
    });
  });

  it('rejects summary longer than 2000 characters with 400', () => {
    const oversized = 'Y'.repeat(2001);
    assert.deepEqual(validateLessonSummary(oversized), {
      valid: false,
      reason: 'Lesson summary must be 2000 characters or fewer.',
    });
  });
});

describe('assertCanCompleteBooking (BR-14, AC-16.1, AC-16.4, AC-16.5, STS-16.1, STS-16.3, STS-16.4)', () => {
  const confirmedBooking = { id: 101, tutorId: 5, status: 'CONFIRMED' as const };
  const cancelledBooking = { id: 102, tutorId: 5, status: 'CANCELLED' as const };
  const completedBooking = { id: 103, tutorId: 5, status: 'COMPLETED' as const };

  it('allows assigned tutor to complete a confirmed booking', () => {
    assert.doesNotThrow(() => {
      assertCanCompleteBooking(confirmedBooking, 5, 'TUTOR');
    });
  });

  it('rejects non-tutor roles (STUDENT, ADMIN) with 403 Forbidden', () => {
    assert.throws(
      () => assertCanCompleteBooking(confirmedBooking, 5, 'STUDENT'),
      (err: any) => err.statusCode === 403 && /only tutors can mark lessons as completed/i.test(err.message),
    );
    assert.throws(
      () => assertCanCompleteBooking(confirmedBooking, 5, 'ADMIN'),
      (err: any) => err.statusCode === 403 && /only tutors can mark lessons as completed/i.test(err.message),
    );
  });

  it('rejects another tutor who is not the assigned tutor with 403 Forbidden', () => {
    assert.throws(
      () => assertCanCompleteBooking(confirmedBooking, 999, 'TUTOR'),
      (err: any) => err.statusCode === 403 && /only complete your own appointments/i.test(err.message),
    );
  });

  it('rejects booking that is already CANCELLED with 409 Conflict', () => {
    assert.throws(
      () => assertCanCompleteBooking(cancelledBooking, 5, 'TUTOR'),
      (err: any) => err.statusCode === 409 && /only confirmed bookings can be marked as completed/i.test(err.message),
    );
  });

  it('rejects booking that is already COMPLETED with 409 Conflict', () => {
    assert.throws(
      () => assertCanCompleteBooking(completedBooking, 5, 'TUTOR'),
      (err: any) => err.statusCode === 409 && /only confirmed bookings can be marked as completed/i.test(err.message),
    );
  });
});
