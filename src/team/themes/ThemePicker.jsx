import { CannaLeaf, PixelIcon } from './art.jsx'
import { THEMES } from './index.js'
import { SoundSwitch } from './TrainerHero.jsx'

// A small preview of each theme for the picker.
function Swatch({ id }) {
  if (id === 'pixel') return <span className="sw sw-pixel"><PixelIcon name="heart" size={3} /><PixelIcon name="coin" size={3} /></span>
  if (id === 'trainer') return <span className="sw sw-trainer"><i>HP</i><b /></span>
  if (id === 'cats') return <span className="sw sw-cats">🐾</span>
  if (id === 'catnip') return <span className="sw sw-catnip">🌿</span>
  if (id === 'leaf') return <span className="sw sw-leaf"><CannaLeaf size={32} color="#7fc45a" /></span>
  return <span className="sw sw-classic"><i /></span>
}

// Choose your own theme (⚙️ Settings), with sound effects for the game themes.
// Saved to your account; nobody else can change it.
export function ThemeOptions({ data }) {
  const current = data.theme ?? 'classic'
  const picked = THEMES.find((t) => t.id === current)
  return (
    <>
      <div className="th-picker" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={t.id === current} className={`th-opt ${t.id === current ? 'on' : ''}`} onClick={() => data.actions.setTheme(t.id, data.sounds)}>
            <Swatch id={t.id} />
            <span className="th-opt-text">
              <b>{t.name}</b>
              <small>{t.blurb}</small>
            </span>
            <i className="th-tick" />
          </button>
        ))}
      </div>
      {picked?.sounds && <SoundSwitch data={data} />}
    </>
  )
}
