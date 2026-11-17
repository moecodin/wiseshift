import { useLayoutEffect, useRef, useState } from 'react'

// The row of seven day buttons (S M T W T F S). The highlight slides to the day
// you pick. renderDay(day, isSelected) returns that day's <button className="sc-day">.
export default function DayStrip({ days, selected, renderDay }) {
  const ref = useRef(null)
  const [box, setBox] = useState(null)
  const first = days[0]
  useLayoutEffect(() => {
    const place = () => {
      const on = ref.current?.querySelector('.sc-day.on')
      if (on) setBox({ left: on.offsetLeft, width: on.offsetWidth, height: on.offsetHeight })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [selected, first])
  return (
    <div className="sc-strip" role="group" aria-label="Days" ref={ref}>
      {box && <span className="sc-ind" aria-hidden="true" style={{ transform: `translateX(${box.left}px)`, width: box.width, height: box.height }} />}
      {days.map((d) => renderDay(d, d === selected))}
    </div>
  )
}
