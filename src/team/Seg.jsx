import { useLayoutEffect, useRef, useState } from 'react'

// A row of "pick one" buttons (the buttons carry aria-pressed). The highlight is one pill that slides to the picked button.
export default function Seg({ children, ...props }) {
  const ref = useRef(null)
  const [box, setBox] = useState(null)
  // After every render: find the picked button and move the pill under it (only when it actually moved).
  useLayoutEffect(() => {
    const place = () => {
      const on = ref.current?.querySelector('[aria-pressed="true"]')
      const next = on ? { left: on.offsetLeft, top: on.offsetTop, width: on.offsetWidth, height: on.offsetHeight } : null
      setBox((prev) => (prev && next && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height ? prev : next))
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  })
  return (
    <div {...props} ref={ref} className={`${props.className ?? ''} seg-host`}>
      {box && <span className="seg-ind" aria-hidden="true" style={{ transform: `translate(${box.left}px, ${box.top}px)`, width: box.width, height: box.height }} />}
      {children}
    </div>
  )
}
