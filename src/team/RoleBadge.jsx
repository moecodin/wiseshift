// A shift's role (Front desk, Kennel…) as a small outlined badge with a colored
// dot. The color comes from the Roles list in Settings; a role that was later
// removed from the list still shows, with a gray dot.
export default function RoleBadge({ role, roles = [] }) {
  const name = (role || '').trim()
  if (!name) return null
  const found = roles.find((r) => r.name.trim().toLowerCase() === name.toLowerCase())
  const color = Number.isInteger(found?.color) ? found.color : null
  return (
    <span className="rl-badge">
      <i className={`rl-dot ${color === null ? 'none' : `t${color}`}`} aria-hidden="true" />
      {name}
    </span>
  )
}
