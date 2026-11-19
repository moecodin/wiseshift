import { useEffect, useRef, useState } from 'react'

// A number that shows its value straight away and, when the value later changes (an approval, a clock-in),
// eases to the new one in a quarter of a second so the change is visible. It never counts up on first
// show, and with reduced motion it just switches.
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
export default function Tick({ value, format = (n) => n.toFixed(2), ms = 250 }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduced() || from.current === value) {
      from.current = value
      setShown(value) // eslint-disable-line react-hooks/set-state-in-effect
      return undefined
    }
    const start = performance.now()
    const begin = from.current
    let frame = 0
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms)
      const now = begin + (value - begin) * (1 - (1 - p) ** 3)
      from.current = now
      setShown(now)
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, ms])
  return <>{format(shown)}</>
}
