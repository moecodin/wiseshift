// Small helpers for the first-run wizards and the Business settings (kept apart from the components).

const SEEN_PREFIX = 'wiseshift-welcome-'
export const welcomeSeen = (id) => {
  try {
    return localStorage.getItem(SEEN_PREFIX + id) === '1'
  } catch {
    return true // if this device can't remember, don't ask every time
  }
}
export const markSeen = (id) => {
  try {
    localStorage.setItem(SEEN_PREFIX + id, '1')
  } catch {
    // Not important if this can't be saved.
  }
}

// A chosen image, shrunk to at most 192px on its longest side and returned as a PNG data URL.
export function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('bad'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 192 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const out = canvas.toDataURL('image/png')
      if (out.length > 100000) reject(new Error('big'))
      else resolve(out)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('bad'))
    }
    img.src = url
  })
}
