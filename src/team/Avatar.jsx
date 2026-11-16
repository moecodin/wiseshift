// A round badge with someone's initials ("SS"), in a color that stays the same for them.
const COLORS = ['#5ed6a8', '#7aa7f0', '#f2a65a', '#c39bf0', '#f07a8c', '#5bc0d6', '#b7c95a']

export default function Avatar({ employee, size = 40 }) {
  const name = employee?.name ?? '?'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  const hash = [...(employee?.id ?? name)].reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return (
    <span className="tm-avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: COLORS[hash % COLORS.length] }} aria-hidden="true">
      {initials}
    </span>
  )
}
