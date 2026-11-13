import { describe, expect, it } from 'vitest'
import { attachmentError, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, mergeAttachments } from './attachments'

const file = (name: string, size = 1000) => ({ name, size, type: 'application/pdf' })

describe('attachmentError (booking lecture files)', () => {
  it('accepts up to the file limit within the size limit', () => {
    expect(attachmentError([file('a.pdf'), file('b.pdf', MAX_ATTACHMENT_BYTES)])).toBeNull()
  })

  it('rejects too many files', () => {
    const many = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, i) => file(`f${i}.pdf`))
    expect(attachmentError(many)).toBe(`Attach at most ${MAX_ATTACHMENTS} files.`)
  })

  it('names the first file over the size limit', () => {
    expect(attachmentError([file('ok.pdf'), file('huge.pdf', MAX_ATTACHMENT_BYTES + 1)])).toBe(
      'huge.pdf is larger than 20 MB.',
    )
  })

  it('rejects a file with a blank name', () => {
    expect(attachmentError([file('  ')])).toBe('Each file needs a name.')
  })
})

describe('mergeAttachments', () => {
  it('adds new picks and skips ones already attached (same name and size)', () => {
    expect(mergeAttachments([file('a.pdf')], [file('a.pdf'), file('a.pdf', 2000), file('b.pdf')])).toEqual([
      file('a.pdf'),
      file('a.pdf', 2000),
      file('b.pdf'),
    ])
  })
})
