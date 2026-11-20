// The language the screens are showing ('en' or 'es', from Settings → Language). useTeamData sets it on every load,
// before the screens draw, so any component can say tr('Approve', 'Aprobar') without passing lang down.
let LANG = 'en'

export const setUiLang = (lang) => {
  LANG = lang === 'es' ? 'es' : 'en'
}
export const uiLang = () => LANG
export const isEs = () => LANG === 'es'
// English or Spanish words, picked by the current language.
export const tr = (en, es) => (LANG === 'es' ? es : en)
export const uiLocale = () => (LANG === 'es' ? 'es-US' : 'en-US')
