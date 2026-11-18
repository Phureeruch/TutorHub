import { useState, type RefObject } from 'react'

export interface FieldError<F extends string> {
  /** The field to flag with aria-invalid and focus, or null for a form-level error. */
  field: F | null
  message: string
}

type FieldRefs<F extends string> = Partial<Record<F, RefObject<HTMLInputElement | HTMLSelectElement | null>>>

/**
 * Form error state that knows which field failed: that field gets
 * aria-invalid and focus, so keyboard and screen-reader users land on it.
 */
export function useFieldError<F extends string>(refs: FieldRefs<F>) {
  const [error, setError] = useState<FieldError<F> | null>(null)
  const fail = (next: FieldError<F>) => {
    setError(next)
    if (next.field) refs[next.field]?.current?.focus()
  }
  const invalidProps = (field: F) => ({ 'aria-invalid': error?.field === field ? (true as const) : undefined })
  // Editing the flagged field clears its invalid state; the message stays until the next submit.
  const clearField = (field: F) => {
    if (error?.field === field) setError({ ...error, field: null })
  }
  return { error, setError, fail, invalidProps, clearField }
}
