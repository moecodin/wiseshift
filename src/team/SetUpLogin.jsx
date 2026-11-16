import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

// "First time here, or forgot your password?" on the team sign-in page.
// The employee types their email, gets a code by email, types it in, then
// chooses a password. Any email can get a code (the booking site already lets
// anyone make a login), but only emails on the team list get into the page.
// `onChoosing(true)` is called just before signing in with the code, so the page
// asks for a password as soon as the sign-in lands.
export function SetUpLogin({ onChoosing, onBack }) {
  const [step, setStep] = useState('email') // 'email', 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sendCode = async (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Type your email.')
    setBusy(true)
    const { error: problem } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (problem) return setError(problem.status === 429 ? 'Too many tries. Wait a minute and try again.' : problem.message)
    setError('')
    setStep('code')
  }

  const checkCode = async (e) => {
    e.preventDefault()
    const token = code.replace(/\s/g, '')
    if (!/^\d{6,10}$/.test(token)) return setError('Type the code from the email.')
    setBusy(true)
    onChoosing(true)
    const { error: problem } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })
    setBusy(false)
    if (problem) {
      onChoosing(false)
      setError("That code isn't right or has expired. Check the email or send a new one.")
    }
  }

  return (
    <main className="signin">
      <form className="signin-card" onSubmit={step === 'email' ? sendCode : checkCode} noValidate>
        <h1>Set up your login</h1>
        {step === 'email' ? (
          <>
            <p className="text-secondary small">For your first time, or if you forgot your password. Use the email your manager has for you.</p>
            <label className="form-label" htmlFor="setup-email">Email</label>
            <input id="setup-email" className="form-control mb-3" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />
            {error && <p className="text-danger small" role="alert">{error}</p>}
            <button type="submit" className="btn btn-brand w-100" disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
          </>
        ) : (
          <>
            <p className="text-secondary small">We sent a code to <b>{email.trim()}</b>. It can take a minute; check spam too.</p>
            <label className="form-label" htmlFor="setup-code">Code</label>
            <input id="setup-code" className="form-control mb-3" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => { setCode(e.target.value); setError('') }} />
            {error && <p className="text-danger small" role="alert">{error}</p>}
            <button type="submit" className="btn btn-brand w-100" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
            <button type="button" className="btn btn-link btn-sm w-100 mt-2 text-secondary" onClick={() => { setStep('email'); setCode(''); setError('') }}>
              Send a new code
            </button>
          </>
        )}
        <button type="button" className="btn btn-link btn-sm w-100 mt-1 text-secondary" onClick={onBack}>Back to sign in</button>
      </form>
    </main>
  )
}

// Right after signing in with a code: choose the password for next time.
export function ChoosePassword({ email, onDone }) {
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== again) return setError("The two passwords don't match.")
    setBusy(true)
    const { error: problem } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (problem) return setError(problem.message)
    onDone()
  }

  return (
    <main className="signin">
      <form className="signin-card" onSubmit={save} noValidate>
        <h1>Choose a password</h1>
        <p className="text-secondary small">For signing in as <b>{email}</b> next time.</p>
        <input type="hidden" name="username" autoComplete="username" value={email} />
        <label className="form-label" htmlFor="new-password">New password</label>
        <input id="new-password" className="form-control mb-3" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
        <label className="form-label" htmlFor="new-password-again">Type it again</label>
        <input id="new-password-again" className="form-control mb-3" type="password" autoComplete="new-password" value={again} onChange={(e) => { setAgain(e.target.value); setError('') }} />
        {error && <p className="text-danger small" role="alert">{error}</p>}
        <button type="submit" className="btn btn-brand w-100" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </main>
  )
}
