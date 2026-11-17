import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// A simple pop-up using Bootstrap's modal look (without Bootstrap's JavaScript).
// It fades and rises in, fades out when it closes, locks the page behind it from
// scrolling, and on a phone it is a sheet from the bottom that can be dragged down
// to close. All the motion is skipped for people who asked for reduced motion.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const phone = () => window.matchMedia?.('(max-width: 575px)').matches
const LEAVE_MS = 160
const SAVED_MS = 560 // a box closed by its main button (Save, Send…) shows a check mark first

// Page scroll lock, shared so two pop-ups open at once (or one replacing another) don't unlock early.
let locks = 0
let saved = null
function lockPage() {
  if (locks++ > 0) return
  const body = document.body
  saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
  const gap = window.innerWidth - document.documentElement.clientWidth // the scrollbar's width, so the page doesn't jump
  body.style.overflow = 'hidden'
  if (gap > 0) body.style.paddingRight = `${gap}px`
}
function unlockPage() {
  if (--locks > 0) return
  locks = 0
  document.body.style.overflow = saved?.overflow ?? ''
  document.body.style.paddingRight = saved?.paddingRight ?? ''
}

export default function Modal({ title, children, footer, onClose, size }) {
  const root = useRef(null)
  const content = useRef(null)
  const drag = useRef(null)
  const lastPrimary = useRef(-1e9) // when the main (brand-colored) button was last pressed
  const lastAlert = useRef(-1e9) // when a problem message last appeared or changed
  const body = useRef(null)

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  useEffect(() => {
    lockPage()
    return unlockPage
  }, [])

  // React removes the pop-up the moment it closes, so to fade it out a copy is left behind
  // for a moment, playing the leaving animation, then removed.
  useLayoutEffect(() => {
    const node = root.current
    return () => {
      if (!node || reduced()) return
      const ghost = node.cloneNode(true)
      // Closed soon after pressing the main button, and no new problem message since: it worked.
      const saved = performance.now() - lastPrimary.current < 4000 && lastAlert.current < lastPrimary.current
      ghost.classList.add('leaving')
      if (saved) ghost.classList.add('saved')
      ghost.setAttribute('aria-hidden', 'true')
      ghost.removeAttribute('role')
      // In development React mounts, unmounts and re-mounts a component once to catch mistakes.
      // That fake unmount leaves the box on the page, so only a box that really went away gets a ghost.
      queueMicrotask(() => {
        if (node.isConnected) return
        document.body.appendChild(ghost)
        setTimeout(() => ghost.remove(), (saved ? SAVED_MS : LEAVE_MS) + 40)
      })
    }
  }, [])

  // A message that says something went wrong (an alert) makes the box shake once.
  useEffect(() => {
    if (reduced() || !root.current) return undefined
    let timer = 0
    const mo = new MutationObserver((list) => {
      const alert = list.some((m) => {
        const el = m.target.nodeType === 3 ? m.target.parentElement : m.target
        return el?.closest?.('[role="alert"]') || [...m.addedNodes].some((n) => n.nodeType === 1 && (n.matches?.('[role="alert"]') || n.querySelector?.('[role="alert"]')))
      })
      if (!alert || !body.current) return
      lastAlert.current = performance.now()
      body.current.classList.remove('shake')
      void body.current.offsetWidth // restart the animation if it was already shaking
      body.current.classList.add('shake')
      clearTimeout(timer)
      timer = setTimeout(() => body.current?.classList.remove('shake'), 450)
    })
    mo.observe(root.current, { childList: true, subtree: true, characterData: true })
    return () => {
      mo.disconnect()
      clearTimeout(timer)
    }
  }, [])

  // Phone: drag the top of the sheet down to close it.
  const down = (e) => {
    if (!phone() || reduced() || e.target.closest('button')) return
    drag.current = { y: e.clientY, dy: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (content.current) content.current.style.transition = 'none'
  }
  const move = (e) => {
    if (!drag.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.y)
    if (content.current) content.current.style.transform = `translateY(${drag.current.dy}px)`
  }
  const up = () => {
    if (!drag.current) return
    const { dy } = drag.current
    drag.current = null
    if (dy > 110) return onClose()
    if (content.current) {
      content.current.style.transition = 'transform 0.2s ease'
      content.current.style.transform = ''
    }
  }

  return createPortal(
    <div className="pu-root" ref={root} onClickCapture={(e) => e.target.closest?.('.btn-brand') && (lastPrimary.current = performance.now())}>
      <div className="modal d-block" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className={`modal-dialog modal-dialog-centered ${size ? `modal-${size}` : ''}`}>
          <div className="modal-content pop-in" ref={content}>
            <div className="modal-header pu-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              <h2 className="modal-title fs-5">{title}</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body" ref={body}>{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </div>,
    document.body,
  )
}
