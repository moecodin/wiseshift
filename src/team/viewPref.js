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
