// Drawings for the themes. All original: pixel icons from little letter maps,
// and Melissa's two cats (black and tuxedo) as simple vector shapes.

// ---------- Pixel icons ----------
// K outline, R red, W white, Y yellow, O gold, P pink, G glass, B brown, U blue, E empty.
const C = { K: '#1b1b2e', R: '#e8323c', W: '#ffffff', Y: '#ffd23f', O: '#c97f10', P: '#ff6fae', G: '#d7f1ff', B: '#8a5a2b', U: '#47b4ff', E: '#f3ead5' }
const HEART = ['.KK...KK.', 'KRRK.KRRK', 'KRWRKRRRK', 'KRRRRRRRK', '.KRRRRRK.', '..KRRRK..', '...KRK...', '....K....']
const ICONS = {
  heart: HEART,
  heartEmpty: HEART.map((r) => r.replace(/[RW]/g, 'E')),
  heartHalf: HEART.map((r) => [...r].map((c, i) => (i > 4 && 'RW'.includes(c) ? 'E' : c)).join('')),
  heartBroken: ['.KK...KK.', 'KRRK.KRRK', 'KRWRKKRRK', 'KRRRK.KRK', '.KRRRKRK.', '..KRK.K..', '...KRK...', '....K....'],
  coin: ['..KKKK..', '.KYYYYK.', 'KYWYOYYK', 'KYWYOYYK', 'KYYYOYYK', 'KYYYOYYK', '.KYYYYK.', '..KKKK..'],
  star: ['.....K.....', '....KYK....', '...KYYYK...', 'KKKKYYYKKKK', 'KYYYYWYYYYK', '.KYYYYYYYK.', '..KYYYYYK..', '..KYYKYYK..', '.KYYK.KYYK.', '.KKK...KKK.'],
  potion: ['..KKKK..', '..KBBK..', '...KK...', '..KGGK..', '.KGGGGK.', 'KPPPPPPK', 'KPWPPPPK', 'KPPPPPPK', '.KPPPPK.', '..KKKK..'],
  bolt: ['...KKKK', '..KYYK.', '.KYYK..', 'KYYYYKK', 'KKKYYYK', '..KYYK.', '.KYYK..', '.KYK...', 'KYK....', 'KK.....'],
  skull: ['.KKKKKKK.', 'KWWWWWWWK', 'KWWWWWWWK', 'KWKKWKKWK', 'KWKKWKKWK', 'KWWWKWWWK', '.KWWWWWK.', '..KWKWK..', '..KKKKK..'],
  trophy: ['KKKKKKKKKK', 'KYKYYYYKYK', 'KYKYWYYKYK', '.KKYYYYKK.', '...KYYK...', '....KK....', '....KK....', '..KKKKKK..', '..KOOOOK..', '..KKKKKK..'],
  crown: ['K....K....K', 'KK..KYK..KK', 'KYK.KYK.KYK', 'KYYKYYYKYYK', 'KYYYYRYYYYK', 'KYYYYYYYYYK', 'KKKKKKKKKKK'],
  clock: ['..KKKKK..', '.KWWWWWK.', 'KWWWKWWWK', 'KWWWKWWWK', 'KWWWKKKWK', 'KWWWWWWWK', 'KWWWWWWWK', '.KWWWWWK.', '..KKKKK..'],
  hourglass: ['KKKKKKK', 'KYYYYYK', '.KYYYK.', '..KYK..', '...K...', '..K.K..', '.K.Y.K.', 'KYYYYYK', 'KKKKKKK'],
  gem: ['..KKKKK..', '.KUWUUUK.', 'KUWUUUUUK', '.KUUUUUK.', '..KUUUK..', '...KUK...', '....K....'],
  flag: ['KK.....', 'KRRRRK.', 'KRRRRRK', 'KRRRRK.', 'KK.....', 'KK.....', 'KK.....', 'KK.....'],
  bone: ['.KK....KK.', 'KWWKKKKWWK', '.KWWWWWWK.', 'KWWKKKKWWK', '.KK....KK.'],
  chest: ['.KKKKKKKK.', 'KBBBBBBBBK', 'KBOOOOOOBK', 'KKKKYYKKKK', 'KBBBYYBBBK', 'KBBBBBBBBK', 'KBBBBBBBBK', 'KKKKKKKKKK'],
}

export function PixelIcon({ name, size = 2, title }) {
  const map = ICONS[name]
  const w = Math.max(...map.map((r) => r.length))
  return (
    <svg className="px-ic" width={w * size} height={map.length * size} viewBox={`0 0 ${w} ${map.length}`} shapeRendering="crispEdges" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {map.flatMap((row, y) => [...row].map((c, x) => (C[c] ? <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={C[c]} /> : null)))}
    </svg>
  )
}

// ---------- Melissa's cats ----------
const BLACK = '#1e1a24'
const TUX = '#24222c'
const PINK = '#f59ac0'

function Ears({ fur }) {
  return (
    <>
      <path d="M26 44 L30 10 L52 30 Z" fill={fur} /><path d="M94 44 L90 10 L68 30 Z" fill={fur} />
      <path d="M32 36 L34 18 L46 30 Z" fill={PINK} /><path d="M88 36 L86 18 L74 30 Z" fill={PINK} />
    </>
  )
}

// A sitting cat, front view. `kind` 'black' or 'tux'; `eyes` 'open' or 'hearts'.
export function Cat({ kind = 'black', eyes = 'open', size = 92 }) {
  const fur = kind === 'tux' ? TUX : BLACK
  const tail = kind === 'tux' ? 'M32 108 C2 104 4 70 18 62' : 'M88 108 C118 104 116 70 102 62'
  const eyeColor = kind === 'tux' ? '#f2c94c' : '#c6e85a'
  return (
    <svg width={size} height={size * 1.08} viewBox="0 0 120 130" aria-hidden="true" className="th-cat">
      <path className="th-wag" d={tail} fill="none" stroke={fur} strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="60" cy="96" rx="34" ry="30" fill={fur} />
      {kind === 'tux' && <path d="M60 70 C44 74 42 100 48 122 L72 122 C78 100 76 74 60 70 Z" fill="#fff" />}
      <Ears fur={fur} />
      <circle cx="60" cy="50" r="32" fill={fur} />
      {kind === 'tux' && <path d="M60 40 C50 52 40 60 42 72 C50 80 70 80 78 72 C80 60 70 52 60 40 Z" fill="#fff" />}
      {eyes === 'hearts' ? (
        <>
          <path d="M46 56 C38 50 38 42 44 42 C46 42 46 44 46 44 C46 44 46 42 48 42 C54 42 54 50 46 56Z" fill="#ff5c8a" />
          <path d="M74 56 C66 50 66 42 72 42 C74 42 74 44 74 44 C74 44 74 42 76 42 C82 42 82 50 74 56Z" fill="#ff5c8a" />
        </>
      ) : (
        <>
          <ellipse cx="47" cy="50" rx="8" ry="9" fill={eyeColor} /><ellipse cx="73" cy="50" rx="8" ry="9" fill={eyeColor} />
          <ellipse cx="47" cy="51" rx="3" ry="7" fill="#11101a" /><ellipse cx="73" cy="51" rx="3" ry="7" fill="#11101a" />
          <circle cx="44.5" cy="46" r="2" fill="#fff" /><circle cx="70.5" cy="46" r="2" fill="#fff" />
        </>
      )}
      <path d="M57 61 L63 61 L60 65 Z" fill={PINK} />
      <path d="M60 65 Q56 70 52 67 M60 65 Q64 70 68 67" fill="none" stroke={kind === 'tux' ? '#9a8fa6' : '#6a6276'} strokeWidth="2" strokeLinecap="round" />
      <path d="M40 62 L22 58 M40 66 L22 68 M80 62 L98 58 M80 66 L98 68" stroke={kind === 'tux' ? '#bdb4c6' : '#6a6276'} strokeWidth="1.6" strokeLinecap="round" />
      {kind === 'tux' ? (
        <>
          <ellipse cx="45" cy="122" rx="10" ry="6" fill="#fff" stroke={TUX} strokeWidth="2" /><ellipse cx="75" cy="122" rx="10" ry="6" fill="#fff" stroke={TUX} strokeWidth="2" />
        </>
      ) : (
        <>
          <ellipse cx="45" cy="122" rx="10" ry="6" fill={BLACK} /><ellipse cx="75" cy="122" rx="10" ry="6" fill={BLACK} />
        </>
      )}
    </svg>
  )
}

// The black cat on her back, paws up, blissed out (Catnip).
export function CatRolling({ size = 150 }) {
  return (
    <svg width={size} height={size * 0.67} viewBox="0 0 150 100" aria-hidden="true" className="th-cat">
      <path className="th-wag" d="M128 70 C150 66 148 40 136 38" fill="none" stroke={BLACK} strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="80" cy="68" rx="48" ry="24" fill={BLACK} />
      <path d="M58 48 L52 22 M74 46 L72 18 M96 46 L100 20 M110 50 L118 26" stroke={BLACK} strokeWidth="10" strokeLinecap="round" />
      <circle cx="36" cy="64" r="26" fill={BLACK} />
      <path d="M14 80 L4 96 L24 88 Z" fill={BLACK} /><path d="M40 90 L44 100 L52 86 Z" fill={BLACK} />
      <path d="M24 58 Q28 54 32 58 M40 58 Q44 54 48 58" fill="none" stroke="#c6e85a" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="22" cy="66" rx="5" ry="3" fill={PINK} opacity=".7" /><ellipse cx="50" cy="66" rx="5" ry="3" fill={PINK} opacity=".7" />
      <path d="M33 68 Q36 73 39 68" fill="none" stroke={PINK} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

// The black cat curled up asleep, snoring.
export function CatSleeping({ size = 140 }) {
  return (
    <svg width={size} height={size * 0.57} viewBox="0 0 140 80" aria-hidden="true" className="th-cat">
      <ellipse cx="74" cy="52" rx="52" ry="26" fill={BLACK} />
      <path d="M26 58 C6 60 8 34 30 38" fill="none" stroke={BLACK} strokeWidth="10" strokeLinecap="round" />
      <circle cx="40" cy="44" r="22" fill={BLACK} />
      <path d="M22 34 L22 14 L36 26 Z" fill={BLACK} /><path d="M50 26 L60 10 L62 32 Z" fill={BLACK} />
      <path d="M30 46 Q34 50 38 46 M44 46 Q48 50 52 46" fill="none" stroke="#c6e85a" strokeWidth="2.4" strokeLinecap="round" />
      <text className="th-zz" x="108" y="26" fontSize="22">z</text>
      <text className="th-zz th-zz2" x="122" y="14" fontSize="16">z</text>
    </svg>
  )
}

// A pink (or purple) toe-bean paw to boop.
export function Paw({ out = false }) {
  return (
    <span className={`th-paw ${out ? 'out' : ''}`} aria-hidden="true">
      <i className="t1" /><i className="t2" /><i className="t3" /><i className="t4" /><i className="pad" />
    </span>
  )
}

// ---------- Leaves ----------
export function CannaLeaf({ size = 34, color = 'currentColor' }) {
  const big = 'M0 10 C-6 -20 -5 -50 0 -60 C5 -50 6 -20 0 10Z'
  const mid = 'M0 10 C-5 -16 -4 -38 0 -48 C4 -38 5 -16 0 10Z'
  const small = 'M0 10 C-4 -12 -3 -26 0 -32 C3 -26 4 -12 0 10Z'
  return (
    <svg width={size} height={size} viewBox="-60 -70 120 120" aria-hidden="true">
      <g fill={color}>
        <path d="M0 10 C-6 -20 -5 -50 0 -66 C5 -50 6 -20 0 10Z" />
        <path d={big} transform="rotate(-34)" /><path d={big} transform="rotate(34)" />
        <path d={mid} transform="rotate(-68)" /><path d={mid} transform="rotate(68)" />
        <path d={small} transform="rotate(-100)" /><path d={small} transform="rotate(100)" />
        <rect x="-1.5" y="8" width="3" height="40" rx="1.5" />
      </g>
    </svg>
  )
}

// A potted catnip plant that grows as the shift goes on (0 to 1) and flowers at the end.
export function CatnipPlant({ grown = 0 }) {
  const pairs = [108, 86, 64, 44] // heights of the leaf pairs, bottom to top
  const shown = Math.max(1, Math.ceil(grown * pairs.length))
  const leaf = 'M0 0 C-14 -2 -22 -14 -18 -28 C-6 -30 4 -20 4 -10 C4 -4 2 -1 0 0Z'
  return (
    <svg width="220" height="150" viewBox="0 0 220 150" role="img" aria-label={`Catnip ${Math.round(grown * 100)}% grown`}>
      <rect x="80" y="122" width="60" height="26" rx="6" fill="#c9875a" stroke="#8a5a34" strokeWidth="3" />
      <path d={`M110 124 C110 110 108 ${130 - grown * 96} 110 ${124 - Math.max(0.2, grown) * 96}`} stroke="#4f8a32" strokeWidth="4" fill="none" />
      {pairs.map((y, i) => (
        <g key={y} opacity={i < shown ? 1 : 0.18}>
          <path d={leaf} transform={`translate(108 ${y}) rotate(-20)`} fill="#8cc860" stroke="#4f8a32" strokeWidth="2" />
          <path d={leaf} transform={`translate(112 ${y}) scale(-1 1) rotate(-20)`} fill="#8cc860" stroke="#4f8a32" strokeWidth="2" />
        </g>
      ))}
      <g opacity={grown >= 1 ? 1 : 0.22}>
        <circle cx="110" cy="24" r="7" fill="#b48cff" /><circle cx="104" cy="16" r="5" fill="#c9a8ff" /><circle cx="116" cy="12" r="5" fill="#b48cff" /><circle cx="110" cy="6" r="4" fill="#c9a8ff" />
      </g>
    </svg>
  )
}
