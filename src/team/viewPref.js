// Remembers whether the whole-team schedule was last shown by day (timeline) or by week (grid).
const KEY = 'wiseshift-team-view'
export function loadSpan() {
  try {
    return localStorage.getItem(KEY) === 'week' ? 'week' : 'day'
  } catch {
    return 'day'
  }
}
export function saveSpan(value) {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // Not important if this can't be saved.
  }
}

// Hours review layout: 'roomy' (a card per punch) or 'compact' (one line each), or null when the person
// hasn't chosen, so the page picks by team size.
const DENSITY_KEY = 'wiseshift-review-density'
export function loadDensity() {
  try {
    const v = localStorage.getItem(DENSITY_KEY)
    return v === 'roomy' || v === 'compact' ? v : null
  } catch {
    return null
  }
}
export function saveDensity(value) {
  try {
    localStorage.setItem(DENSITY_KEY, value)
  } catch {
    // Not important if this can't be saved.
  }
}
