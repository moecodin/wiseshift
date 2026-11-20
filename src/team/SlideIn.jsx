import { useEffect, useRef } from 'react'

// The content under a switch comes in from the right when you go to a later option and from the left when you go back.
// `order` lists the options left to right; `id` is the one showing now.
export default function SlideIn({ id, order, children }) {
  const idx = order.indexOf(id)
  const prev = useRef(idx)
  const last = useRef('r')
  const dir = idx > prev.current ? 'r' : idx < prev.current ? 'l' : last.current
  useEffect(() => {
    prev.current = idx
    last.current = dir
  })
  return <div key={id} className={`slide-in ${dir}`}>{children}</div>
}
