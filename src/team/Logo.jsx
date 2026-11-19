// The WiseShift mark: three bars. Used in the side menu, the header and on the kiosk.
export default function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect className="lg-bar b1" x="6" y="10" width="34" height="13" rx="6.5" fill="var(--navy)" />
      <rect className="lg-bar b2" x="20" y="26" width="38" height="13" rx="6.5" fill="var(--muted)" />
      <rect className="lg-bar b3" x="10" y="42" width="30" height="13" rx="6.5" fill="var(--faint)" />
    </svg>
  )
}
