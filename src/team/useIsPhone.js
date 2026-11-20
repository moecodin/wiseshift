import { useEffect, useState } from 'react'

// True on a phone-sized screen (the same 900px line the layout uses). Follows the window if it is resized or a tablet is rotated.
const QUERY = '(max-width: 899px)'
export function useIsPhone() {
  const [phone, setPhone] = useState(() => window.matchMedia?.(QUERY).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    if (!mq) return undefined
    const change = (e) => setPhone(e.matches)
    mq.addEventListener('change', change)
    return () => mq.removeEventListener('change', change)
  }, [])
  return phone
}
