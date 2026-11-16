import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// A simple pop-up using Bootstrap's modal look (without Bootstrap's JavaScript).
export default function Modal({ title, children, footer, onClose, size }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  return createPortal(
    <>
      <div className="modal d-block" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className={`modal-dialog modal-dialog-centered ${size ? `modal-${size}` : ''}`}>
          <div className="modal-content pop-in">
            <div className="modal-header">
              <h2 className="modal-title fs-5">{title}</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>,
    document.body,
  )
}
