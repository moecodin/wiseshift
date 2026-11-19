// The Black & Gold and Charcoal dark styles were retired in the statement redesign: dark is one
// calm palette now. These stay so older saved choices and the Settings screen keep working until
// that screen is cleaned up; nothing sets data-dark-style on the page any more.
export function getDarkStyle() {
  return 'statement'
}

export function applyDarkStyle() {
  requestAnimationFrame(() => {
    const bar = document.querySelector('meta[name="theme-color"]')
    if (bar) bar.content = getComputedStyle(document.body).backgroundColor
  })
}

export function setDarkStyle() {}
