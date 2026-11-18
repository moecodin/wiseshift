// Which dark look to use when dark mode is on: 'gold' (black and gold, the default) or 'charcoal'.
// It is saved on this device and put on the page as data-dark-style so the CSS can switch palettes.
const KEY = 'wiseshift-dark-style'

export function getDarkStyle() {
  try {
    return localStorage.getItem(KEY) === 'charcoal' ? 'charcoal' : 'gold'
  } catch {
    return 'gold'
  }
}

export function applyDarkStyle(style) {
  document.documentElement.dataset.darkStyle = style
  // The phone's browser bar follows the page color.
  requestAnimationFrame(() => {
    const bar = document.querySelector('meta[name="theme-color"]')
    if (bar) bar.content = getComputedStyle(document.body).backgroundColor
  })
}

export function setDarkStyle(style) {
  applyDarkStyle(style)
  try {
    localStorage.setItem(KEY, style)
  } catch {
    // Not important if this can't be saved.
  }
}

applyDarkStyle(getDarkStyle())
