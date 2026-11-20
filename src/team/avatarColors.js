// Badge colors. Everyone has one: the one they picked, or else the least-used color so the team looks different.
export const AVATAR_COLORS = ['slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink']

// The color nobody (or the fewest people) is using.
export function leastUsedColor(colors) {
  const counts = Object.fromEntries(AVATAR_COLORS.map((c) => [c, 0]))
  for (const c of colors) if (c in counts) counts[c] += 1
  return AVATAR_COLORS.reduce((best, c) => (counts[c] < counts[best] ? c : best), AVATAR_COLORS[1])
}

// The list with every person's avatarColor filled in. People with no pick, in id order, take the least-used color,
// so adding or removing people only moves the colors of people who never picked one.
export function withAvatarColors(list) {
  const used = list.map((e) => e.avatarColor).filter(Boolean)
  const auto = {}
  for (const e of [...list].filter((x) => !x.avatarColor).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const c = leastUsedColor(used)
    auto[e.id] = c
    used.push(c)
  }
  return list.map((e) => (e.avatarColor ? e : { ...e, avatarColor: auto[e.id], avatarAuto: true }))
}
