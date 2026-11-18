import type { BookingAttachment } from '../types/types'

export const MAX_ATTACHMENTS = 5
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
export const MAX_ATTACHMENT_MB = MAX_ATTACHMENT_BYTES / (1024 * 1024)

/**
 * Lecture-file limits, shared by the booking dialog (instant feedback) and the
 * mock API (the check the server will own). Null when the list is acceptable.
 */
export function attachmentError(files: BookingAttachment[]): string | null {
  if (files.length > MAX_ATTACHMENTS) return `Attach at most ${MAX_ATTACHMENTS} files.`
  if (files.some((f) => !f.name.trim())) return 'Each file needs a name.'
  const tooBig = files.find((f) => f.size > MAX_ATTACHMENT_BYTES)
  return tooBig ? `${tooBig.name} is larger than ${MAX_ATTACHMENT_MB} MB.` : null
}

/** Name + size identifies a pick: the same file twice is a no-op, two different notes.pdf are both kept. */
export const attachmentKey = (f: BookingAttachment) => `${f.name}:${f.size}`

export function mergeAttachments(current: BookingAttachment[], picked: BookingAttachment[]): BookingAttachment[] {
  const seen = new Set(current.map(attachmentKey))
  const added: BookingAttachment[] = []
  for (const file of picked) {
    if (seen.has(attachmentKey(file))) continue
    seen.add(attachmentKey(file))
    added.push(file)
  }
  return [...current, ...added]
}
