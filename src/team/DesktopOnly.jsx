import { useState } from 'react'

// Shown on a phone in place of a desk-sized tool (Reports, Business settings): says to open WiseShift on a computer,
// with a button to copy the link and one to email it to yourself.
const WORDS = {
  en: { note: (n) => `${n} works best on a computer`, body: 'Open WiseShift in a browser on your computer to use it. Everything else you need on the go is here.', copy: 'Copy link', copied: 'Link copied', mail: 'Email me the link', subject: 'WiseShift link' },
  es: { note: (n) => `${n} funciona mejor en una computadora`, body: 'Abre WiseShift en un navegador de tu computadora para usarlo. Todo lo demás que necesitas en el teléfono está aquí.', copy: 'Copiar enlace', copied: 'Enlace copiado', mail: 'Envíame el enlace por correo', subject: 'Enlace de WiseShift' },
}

export default function DesktopOnly({ name, lang = 'en' }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}${import.meta.env.BASE_URL}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Not important if the browser won't copy; the email button still works.
    }
  }
  return (
    <div className="tm-narrow">
      <section className="tm-card do-card">
        <h2>{w.note(name)}</h2>
        <p>{w.body}</p>
        <div className="do-actions">
          <button type="button" className="btn btn-brand" onClick={copy}>{copied ? w.copied : w.copy}</button>
          <a className="btn btn-outline-secondary" href={`mailto:?subject=${encodeURIComponent(w.subject)}&body=${encodeURIComponent(link)}`}>{w.mail}</a>
        </div>
      </section>
    </div>
  )
}
