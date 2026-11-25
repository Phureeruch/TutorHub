import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateSubjectInput,
  assertTutorIsApproved,
} from '../src/utils/admin-validation.js';

describe('validateSubjectInput (AC-13.4, AC-13.5, STS-13.3)', () => {
  it('accepts valid subject name and description', () => {
    const result = validateSubjectInput({
      name: 'Discrete Math',
      description: 'Logic, sets, functions, and graph theory.',
    });
    assert.deepEqual(result, {
      valid: true,
      data: {
        name: 'Discrete Math',
        description: 'Logic, sets, functions, and graph theory.',
      },
    });
  });

  it('accepts subject with omitted or blank description, normalizing to null', () => {
    const result1 = validateSubjectInput({ name: 'Linear Algebra' });
    assert.deepEqual(result1, {
      valid: true,
      data: { name: 'Linear Algebra', description: null },
    });

    const result2 = validateSubjectInput({ name: 'Linear Algebra', description: '   ' });
    assert.deepEqual(result2, {
      valid: true,
      data: { name: 'Linear Algebra', description: null },
    });
  });

  it('rejects blank or short subject name (< 2 characters)', () => {
    const result1 = validateSubjectInput({ name: '   ' });
    assert.equal(result1.valid, false);
    if (!result1.valid) {
      assert.equal(result1.reason, 'Subject name must be between 2 and 80 characters.');
    }

    const result2 = validateSubjectInput({ name: 'A' });
    assert.equal(result2.valid, false);
    if (!result2.valid) {
      assert.equal(result2.reason, 'Subject name must be between 2 and 80 characters.');
    }
  });

  it('rejects subject name > 80 characters', () => {
    const result = validateSubjectInput({ name: 'A'.repeat(81) });
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.reason, 'Subject name must be between 2 and 80 characters.');
    }
  });

  it('rejects description > 300 characters', () => {
    const result = validateSubjectInput({
      name: 'Valid Subject',
      description: 'D'.repeat(301),
    });
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.reason, 'Description must be 300 characters or fewer.');
    }
  });
});

describe('assertTutorIsApproved (BR-02, AC-13.3, STS-13.1)', () => {
  it('allows approved tutor to manage availability', () => {
    assert.doesNotThrow(() => {
      assertTutorIsApproved(true);
    });
  });

  it('throws 403 Forbidden error for unapproved tutor', () => {
    assert.throws(
      () => {
        assertTutorIsApproved(false);
      },
      (error: unknown) => {
        const err = error as { statusCode?: number; message?: string };
        return (
          err.statusCode === 403 &&
          err.message === 'Your tutor account is pending administrator approval.'
        );
      },
    );
  });
});
