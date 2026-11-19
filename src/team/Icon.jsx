// The app's drawn icons for arrows, ticks and close marks (one stroke weight, rounded ends), used instead of
// text glyphs like ‹ › ✓ ✕. It takes its colour from the text around it.
const PATHS = {
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  backspace: 'M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7zM12 9.5l5 5M17 9.5l-5 5',
}

export default function Icon({ name, size = 16 }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  )
}
