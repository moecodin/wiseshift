// A round badge with someone's initials ("SS"). One quiet tone for everyone; the look is in statement.css.

export default function Avatar({ employee, size = 40 }) {
  const name = employee?.name ?? '?'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  return (
    <span className="tm-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {initials}
    </span>
  )
}
