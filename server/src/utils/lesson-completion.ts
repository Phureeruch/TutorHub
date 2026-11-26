export class LessonCompletionError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'LessonCompletionError';
  }
}

/**
 * Validates lesson summary or homework note (FR-13, BR-14, AC-16.3).
 * Must be non-empty string and between 1 and 2000 characters.
 */
export function validateLessonSummary(
  summary: unknown,
): { valid: true; trimmed: string } | { valid: false; reason: string } {
  if (typeof summary !== 'string' || !summary.trim()) {
    return {
      valid: false,
      reason: 'Enter a lesson summary or homework note.',
    };
  }

  const trimmed = summary.trim();
  if (trimmed.length > 2000) {
    return {
      valid: false,
      reason: 'Lesson summary must be 2000 characters or fewer.',
    };
  }

  return {
    valid: true,
    trimmed,
  };
}

/**
 * Enforces permissions and booking status requirements for lesson completion (BR-14, AC-16.1, AC-16.4, AC-16.5).
 */
export function assertCanCompleteBooking(
  booking: { tutorId: number; status: string },
  actorId: number,
  actorRole: string,
): void {
  if (actorRole !== 'TUTOR') {
    throw new LessonCompletionError(
      403,
      'Only tutors can mark lessons as completed.',
    );
  }

  if (booking.tutorId !== actorId) {
    throw new LessonCompletionError(
      403,
      'You can only complete your own appointments.',
    );
  }

  if (booking.status !== 'CONFIRMED') {
    throw new LessonCompletionError(
      409,
      'Only confirmed bookings can be marked as completed.',
    );
  }
}
