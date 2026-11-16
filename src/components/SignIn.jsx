import { useState } from 'react'


const ENGLISH = {
  title: 'WiseShift',
  email: 'Email',
  password: 'Password',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  enterPassword: 'Enter the password.',
  enterBoth: 'Enter the email and password.',
  wrongPassword: "That password isn't right. Try again.",
  other: 'Sign in with a different account',
  back: 'Back',
}

// Sign-in page shown when connected to Supabase.
// `presetEmail` is the account behind the password box; `labels` translate the page;
// `footer` adds something under the form (like a language switch).
export default function SignIn({ onSignIn, presetEmail = '', labels = {}, footer = null, allowOtherAccount = true }) {
  const t = { ...ENGLISH, ...labels }
  const [showEmail, setShowEmail] = useState(!presetEmail)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const login = showEmail ? email.trim() : presetEmail
    if (!login || !password) {
      setError(showEmail ? t.enterBoth : t.enterPassword)
      return
    }
    setBusy(true)
    const { error: problem } = await onSignIn(login, password)
    setBusy(false)
    if (problem) setError(problem.message === 'Invalid login credentials' ? t.wrongPassword : problem.message)
  }

  return (
    <main className="signin">
      <form className="signin-card" onSubmit={submit} noValidate>
        <h1>{t.title}</h1>
        {showEmail ? (
          <>
            <label className="form-label" htmlFor="signin-email">{t.email}</label>
            <input id="signin-email" className="form-control mb-3" type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />
          </>
        ) : (
          // Hidden, so the browser's password manager still knows which account this is.
          <input type="hidden" name="username" autoComplete="username" value={presetEmail} />
        )}
        <label className="form-label" htmlFor="signin-password">{t.password}</label>
        <input id="signin-password" className="form-control mb-3" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
        {error && <p className="text-danger small" role="alert">{error}</p>}
        <button type="submit" className="btn btn-brand w-100" disabled={busy}>{busy ? t.signingIn : t.signIn}</button>
        {presetEmail && allowOtherAccount && (
          <button type="button" className="btn btn-link btn-sm w-100 mt-2 text-secondary" onClick={() => { setShowEmail(!showEmail); setError('') }}>
            {showEmail ? t.back : t.other}
          </button>
        )}
        {footer}
      </form>
    </main>
  )
}
