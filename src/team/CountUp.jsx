import { useEffect, useRef, useState } from 'react'

// A number that counts up to its value (like 39.95) over about 0.7 seconds, then
// follows any change. With reduced motion it just shows the value.
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
export default function CountUp({ value, format = (n) => n.toFixed(2), ms = 700 }) {
  const [shown, setShown] = useState(() => (reduced() ? value : 0))
  const from = useRef(shown)
  useEffect(() => {
    if (reduced()) {
      setShown(value)
      return undefined
    }
    const start = performance.now()
    const begin = from.current
    let frame = 0
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms)
      const eased = 1 - (1 - p) ** 3
      const now = begin + (value - begin) * eased
      from.current = now
      setShown(now)
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, ms])
  return <>{format(shown)}</>
}
