import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose(): void
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Bootstrap modal markup driven by React state (no Bootstrap JS): focus moves
 * in on open, is trapped while open, and returns to the trigger on close.
 */
export function Modal({ title, onClose, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const first = dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    document.body.classList.add('modal-open')

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const [head, tail] = [items[0], items[items.length - 1]]
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault()
        tail.focus()
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault()
        head.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('modal-open')
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <>
      <div className="modal-backdrop show" />
      <div
        className="modal d-block th-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable${size === 'lg' ? ' modal-lg' : ''}`}>
          <div className="modal-content" ref={dialogRef}>
            <div className="modal-header">
              <h2 className="modal-title h3" id={titleId}>
                {title}
              </h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  )
}
