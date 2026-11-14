import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findBookingConflict } from '../src/utils/booking-overlap.js';

function createBooking(
  id: number,
  tutorId: number,
  studentId: number,
  start: string,
  end: string,
) {
  return {
    id,
    tutorId,
    studentId,
    startTime: new Date(start),
    endTime: new Date(end),
  };
}

describe('findBookingConflict', () => {
  it('should detect a conflict with the same tutor', () => {
    const result = findBookingConflict(
      {
        tutorId: 1,
        studentId: 2,
        startTime: new Date('2026-11-10T10:00:00Z'),
        endTime: new Date('2026-11-10T11:00:00Z'),
      },
      [
        createBooking(
          101, 1, 3,
          '2026-11-10T10:30:00Z',
          '2026-11-10T11:30:00Z',
        ),
      ],
    );

    assert.deepEqual(result, {
      type: 'TUTOR',
      bookingId: 101,
    });
  });

  it('should detect a conflict with the same student', () => {
    const result = findBookingConflict(
      {
        tutorId: 2,
        studentId: 1,
        startTime: new Date('2026-11-10T10:00:00Z'),
        endTime: new Date('2026-11-10T11:00:00Z'),
      },
      [
        createBooking(
          102, 3, 1,
          '2026-11-10T10:30:00Z',
          '2026-11-10T11:30:00Z',
        ),
      ],
    );

    assert.deepEqual(result, {
      type: 'STUDENT',
      bookingId: 102,
    });
  });

  it('should allow bookings with different tutors and students', () => {
    const result = findBookingConflict(
      {
        tutorId: 1,
        studentId: 2,
        startTime: new Date('2026-11-10T10:00:00Z'),
        endTime: new Date('2026-11-10T11:00:00Z'),
      },
      [
        createBooking(
          103, 3, 4,
          '2026-11-10T10:00:00Z',
          '2026-11-10T11:00:00Z',
        ),
      ],
    );

    assert.equal(result, null);
  });

  it('should allow bookings that start when another booking ends', () => {
    const result = findBookingConflict(
      {
        tutorId: 1,
        studentId: 2,
        startTime: new Date('2026-11-10T11:00:00Z'),
        endTime: new Date('2026-11-10T12:00:00Z'),
      },
      [
        createBooking(
          104, 1, 3,
          '2026-11-10T10:00:00Z',
          '2026-11-10T11:00:00Z',
        ),
      ],
    );

    assert.equal(result, null);
  });

  it('should allow bookings that end when another booking starts', () => {
    const result = findBookingConflict(
      {
        tutorId: 1,
        studentId: 2,
        startTime: new Date('2026-11-10T09:00:00Z'),
        endTime: new Date('2026-11-10T10:00:00Z'),
      },
      [
        createBooking(
          105, 1, 3,
          '2026-11-10T10:00:00Z',
          '2026-11-10T11:00:00Z',
        ),
      ],
    );

    assert.equal(result, null);
  });

  it('should detect a conflict when the new booking is inside an existing booking', () => {
    const result = findBookingConflict(
      {
        tutorId: 1,
        studentId: 2,
        startTime: new Date('2026-11-10T10:15:00Z'),
        endTime: new Date('2026-11-10T10:45:00Z'),
      },
      [
        createBooking(
          106, 1, 3,
          '2026-11-10T10:00:00Z',
          '2026-11-10T11:00:00Z',
        ),
      ],
    );

    assert.deepEqual(result, {
      type: 'TUTOR',
      bookingId: 106,
    });
  });

  it('should ignore cancelled bookings when checking conflicts', () => {
    const result = findBookingConflict(
      {
        tutorId: 1,
        studentId: 2,
        startTime: new Date('2026-11-10T10:00:00Z'),
        endTime: new Date('2026-11-10T11:00:00Z'),
      },
      [
        {
          ...createBooking(
            107, 1, 3,
            '2026-11-10T10:00:00Z',
            '2026-11-10T11:00:00Z',
          ),
          status: 'CANCELLED',
        },
      ],
    );

    assert.equal(result, null);
  });

  it('should return null when there are no existing bookings', () => {
    const result = findBookingConflict(
      {
        tutorId: 1,
        studentId: 2,
        startTime: new Date('2026-11-10T10:00:00Z'),
        endTime: new Date('2026-11-10T11:00:00Z'),
      },
      [],
    );

    assert.equal(result, null);
  });
});