interface BookingTime {
  tutorId: number;
  studentId: number;
  startTime: Date;
  endTime: Date;
}

interface ExistingBooking extends BookingTime {
  id: number;
  status?: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
}

type ConflictType = 'TUTOR' | 'STUDENT';

interface BookingConflict {
  type: ConflictType;
  bookingId: number;
}

export function findBookingConflict(
  newBooking: BookingTime,
  existingBookings: ExistingBooking[],
): BookingConflict | null {
  const newStart = newBooking.startTime.getTime();
  const newEnd = newBooking.endTime.getTime();

  for (const booking of existingBookings) {
    if (booking.status === 'CANCELLED') continue;

    const existingStart = booking.startTime.getTime();
    const existingEnd = booking.endTime.getTime();

    // Check whether the time intervals overlap
    const isOverlapping =
      newStart < existingEnd && existingStart < newEnd;

    if (!isOverlapping) {
      continue;
    }

    // Check tutor conflict
    if (booking.tutorId === newBooking.tutorId) {
      return {
        type: 'TUTOR',
        bookingId: booking.id,
      };
    }

    // Check student conflict
    if (booking.studentId === newBooking.studentId) {
      return {
        type: 'STUDENT',
        bookingId: booking.id,
      };
    }
  }

  return null;
}