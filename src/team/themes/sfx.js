// Little chiptune sound effects for the game themes (Pixel, Pocket Trainer).
// Made on the phone with square waves, no sound files. Off unless the person
// turns them on in their theme settings.
let audio = null

const TUNES = {
  tap: [[880, 0.05]],
  in: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.16]],
  out: [[784, 0.08], [659, 0.08], [523, 0.16]],
  save: [[660, 0.06], [0, 0.04], [660, 0.06], [990, 0.14]],
  level: [[523, 0.1], [523, 0.1], [523, 0.1], [698, 0.3], [0, 0.06], [659, 0.1], [698, 0.32]],
}

export function playSound(name) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)()
    let t = audio.currentTime + 0.01
    for (const [freq, length] of TUNES[name] ?? []) {
      if (freq) {
        const osc = audio.createOscillator()
        const gain = audio.createGain()
        osc.type = 'square'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.06, t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
        osc.connect(gain).connect(audio.destination)
        osc.start(t)
        osc.stop(t + length)
      }
      t += length
    }
  } catch {
    // No sound on this phone; that's fine.
  }
}
