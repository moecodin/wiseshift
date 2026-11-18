// Dragging a shift (managers): with a mouse, press and drag; on a phone or tablet, press and hold for
// half a second until the shift lifts, then drag (a quick tap still opens the editor and a swipe still
// scrolls). While dragging, a small tag follows the pointer, the lane or cell underneath lights up,
// and on release `onDrop(target)` is called with whatever `resolve` found under the pointer.
//
// startShiftDrag(event, { resolve, onDrop })
//   resolve({ x, y, grab }) → null, or { target, label, over, preview }
//     target   what to hand to onDrop (null/absent = not a valid spot)
//     label    text for the tag that follows the pointer
//     over     the element to highlight (gets the class sd-over)
//     preview  { lane, left, width }: a ghost bar inside `lane`, as percentages
//   grab = { dx, dw }: how far into the shift the pointer was, and the shift's width on screen.
// wasJustDragged() is true for a moment after a drag ends, so the click that follows can be ignored.

let justDragged = false
export const wasJustDragged = () => justDragged

const HOLD_MS = 450 // touch: how long to press before the shift lifts
const MOUSE_SLOP = 5 // mouse: pixels of movement before it counts as a drag
const TOUCH_SLOP = 8 // touch: moving this far before the hold ends means the person is scrolling

export function startShiftDrag(event, { resolve, onDrop }) {
  if (event.button !== undefined && event.button !== 0) return
  const touch = event.pointerType === 'touch' || event.pointerType === 'pen'
  const el = event.currentTarget
  const rect = el.getBoundingClientRect()
  const grab = { dx: event.clientX - rect.left, dw: rect.width }
  const origin = { x: event.clientX, y: event.clientY }
  const id = event.pointerId
  let armed = false
  let last = origin
  let timer = 0
  let ghost = null
  let over = null
  let preview = null
  let target = null

  const paint = (point) => {
    const found = resolve({ x: point.x, y: point.y, grab }) ?? {}
    target = found.target ?? null
    ghost.textContent = found.label ?? ''
    ghost.classList.toggle('bad', !target)
    ghost.style.transform = `translate(${point.x + 14}px, ${point.y + 14}px)`
    if (found.over !== over) {
      over?.classList.remove('sd-over')
      over = found.over ?? null
      over?.classList.add('sd-over')
    }
    if (found.preview) {
      if (!preview) {
        preview = document.createElement('div')
        preview.className = 'sd-preview'
      }
      if (preview.parentElement !== found.preview.lane) found.preview.lane.appendChild(preview)
      preview.style.left = `${found.preview.left}%`
      preview.style.width = `${found.preview.width}%`
    } else {
      preview?.remove()
    }
  }
  const arm = () => {
    armed = true
    el.classList.add('sd-lifted')
    document.body.classList.add('sd-dragging')
    ghost = document.createElement('div')
    ghost.className = 'sd-ghost'
    document.body.appendChild(ghost)
    if (touch) navigator.vibrate?.(12)
    paint(last)
  }
  const cleanup = () => {
    clearTimeout(timer)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey)
    document.removeEventListener('touchmove', guard)
    document.removeEventListener('contextmenu', noMenu)
    el.classList.remove('sd-lifted')
    document.body.classList.remove('sd-dragging')
    over?.classList.remove('sd-over')
    ghost?.remove()
    preview?.remove()
  }
  // Once the shift has lifted, a finger moving must not scroll the page.
  const guard = (e) => armed && e.cancelable && e.preventDefault()
  const noMenu = (e) => e.preventDefault()
  function onMove(e) {
    if (e.pointerId !== id) return
    last = { x: e.clientX, y: e.clientY }
    if (!armed) {
      const moved = Math.hypot(last.x - origin.x, last.y - origin.y)
      if (touch) {
        if (moved > TOUCH_SLOP) cleanup() // scrolling, not dragging
      } else if (moved > MOUSE_SLOP) arm()
      return
    }
    paint(last)
  }
  function onUp(e) {
    if (e.pointerId !== id) return
    const dropped = armed ? target : null
    if (armed) {
      justDragged = true
      setTimeout(() => {
        justDragged = false
      }, 60)
    }
    cleanup()
    if (dropped) onDrop(dropped)
  }
  function onCancel(e) {
    if (e.pointerId === id) cleanup()
  }
  function onKey(e) {
    if (e.key === 'Escape') cleanup()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey)
  if (touch) {
    document.addEventListener('touchmove', guard, { passive: false })
    document.addEventListener('contextmenu', noMenu)
    timer = setTimeout(arm, HOLD_MS)
  }
}
