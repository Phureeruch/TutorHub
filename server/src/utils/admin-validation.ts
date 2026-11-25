export interface SubjectValidationInput {
  name?: unknown;
  description?: unknown;
}

export interface ValidatedSubjectData {
  name: string;
  description: string | null;
}

export type SubjectValidationResult =
  | { valid: true; data: ValidatedSubjectData }
  | { valid: false; reason: string };

export function validateSubjectInput(input: SubjectValidationInput): SubjectValidationResult {
  const rawName = typeof input.name === 'string' ? input.name.trim() : '';

  if (rawName.length < 2 || rawName.length > 80) {
    return {
      valid: false,
      reason: 'Subject name must be between 2 and 80 characters.',
    };
  }

  let description: string | null = null;
  if (typeof input.description === 'string') {
    const trimmedDesc = input.description.trim();
    if (trimmedDesc.length > 300) {
      return {
        valid: false,
        reason: 'Description must be 300 characters or fewer.',
      };
    }
    description = trimmedDesc.length > 0 ? trimmedDesc : null;
  }

  return {
    valid: true,
    data: {
      name: rawName,
      description,
    },
  };
}

export function assertTutorIsApproved(isApproved: boolean): void {
  if (!isApproved) {
    const error = new Error('Your tutor account is pending administrator approval.') as Error & {
      statusCode: number;
    };
    error.statusCode = 403;
    throw error;
  }
}
