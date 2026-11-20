import { useEffect, useRef, useState } from 'react'
import Modal from '../components/Modal.jsx'
import PersonPage from './PersonPage.jsx'
import { money, scheduleOnly } from './format.js'
import { NY_MIN_WAGE } from './taxRates.js'
import { dateKey } from '../lib/dates.js'
import { dayLabel } from './format.js'
import { noticeAcked } from './settings.js'
import Avatar from './Avatar.jsx'
import { useFeatures } from './features.js'
import { clearKioskPin, kioskPinOwners, setKioskPin } from './kioskApi.js'

// A yes / no choice as a rounded button (the same look as the role and day pickers) instead of a
// small browser tick box. Used for Active, Manager and the pay questions.
function PillToggle({ checked, disabled, onChange, children }) {
  return (
    <button type="button" className="rl-pick pe-toggle" aria-pressed={checked} disabled={disabled} onClick={() => onChange(!checked)}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3.2 3.2L15 6.8" /></svg>
      {children}
    </button>
  )
}

const NEW_PAY = {
  hourlyRate: 0, filingStatus: 'single', step2: false, dependents: 0, otherIncome: 0, deductions: 0, extraWithholding: 0,
  pretax: 0, nyStatus: 'single', nyAllowances: 0, nyExtra: 0, nycResident: false,
}

// Managers: who's on the team, their position, pay rate and tax settings.
export default function PeopleTab({ data, me, focus, personId, onPerson, onJump }) {
  const f = useFeatures()
  const [editing, setEditing] = useState(null)
  const focusedPerson = useRef(0)
  useEffect(() => {
    if (focus?.tab === 'people' && focus.n !== focusedPerson.current) {
      focusedPerson.current = focus.n
      if (data.employees.some((x) => x.id === focus.id)) onPerson(focus.id)
    }
  }, [focus, data.employees, onPerson])
  const people = [...data.employees].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

  const person = personId ? data.employees.find((x) => x.id === personId) : null
  if (person) {
    return (
      <>
        <PersonPage person={person} data={data} onBack={() => onPerson(null)} onEdit={() => setEditing(person)} onPunches={() => onJump('hours', person.id)} onSchedule={() => onJump('schedule', person.id)} />
        {editing && <PersonEditor employee={editing} pay={data.payById[editing.id] ?? NEW_PAY} data={data} me={me} onClose={() => setEditing(null)} />}
      </>
    )
  }

  return (
    <div className="tm-narrow desk">
      <div className="pt-head">
        <h2 className="sc-h">Team <small className="mg-sum">{people.filter((e) => e.active).length} active</small></h2>
        <button type="button" className="btn btn-brand btn-sm" data-search="add-person" onClick={() => setEditing({ name: '', email: '', position: '', isManager: false, payType: 'hourly', active: true })}>+ Add person</button>
      </div>
      <div className="pt-list">
      {people.map((e) => {
        const pay = data.payById[e.id]
        const rate = scheduleOnly(e) ? 'Schedule only' : !f.payRates ? '' : e.payType === 'commission' ? 'Commission' : pay?.hourlyRate ? `${money(pay.hourlyRate)}/hr` : 'No rate'
        return (
          <button key={e.id} type="button" className={`sc-row person pt-person ${e.active ? '' : 'inactive'}`} onClick={() => onPerson(e.id)}>
            <Avatar employee={e} size={44} />
            <span className="sc-body">
              <b>
                {e.name}
                {e.isManager && <span className="pt-chip">Manager</span>}
                {!e.active && <span className="pt-chip off">Not active</span>}
              </b>
              <small>{e.position || 'No position'}</small>
              <small>{scheduleOnly(e) ? 'No login' : e.email}</small>
            </span>
            <span className="sc-hrs">{rate}</span>
          </button>
        )
      })}
      </div>
      <details className="pt-help">
        <summary>How to give someone a login</summary>
        <ol>
          <li>Add them here with the email they'll sign in with.</li>
          <li>
            Send them your WiseShift link. They tap <b>First time here, or forgot your password?</b>, type that email, enter
            the code we email them, and choose their own password. Their login only opens their own WiseShift pages.
          </li>
        </ol>
        <p className="tm-muted small">
          Clocking in or out saves the phone's location. Everyone is asked to read the location notice in the app and tap
          <b> I've read this</b> (New York law); see who has in ⚙️ Settings → Business. Also post it where staff can see it.
        </p>
        <p className="tm-muted small mb-0">Someone who leaves: open them and press <b>Remove from team…</b>.</p>
      </details>
      {editing && <PersonEditor employee={editing} pay={data.payById[editing.id] ?? NEW_PAY} data={data} me={me} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PersonEditor({ employee, pay: savedPay, data, me, onClose }) {
  const f = useFeatures()
  const [e, setE] = useState({ ...employee })
  const [pay, setPay] = useState({ ...NEW_PAY, ...savedPay })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const setField = (field) => (ev) => setE({ ...e, [field]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value })
  const setPayField = (field) => (ev) => setPay({ ...pay, [field]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value })
  const self = employee.id === me.id
  const [removing, setRemoving] = useState(false)

  const save = async () => {
    if (!e.name.trim()) return setError('Type their name.')
    const none = e.payType === 'none'
    if (!none && !/^\S+@\S+\.\S+$/.test(e.email.trim())) return setError('Type the email they sign in with.')
    const numbers = Object.fromEntries(
      ['hourlyRate', 'dependents', 'otherIncome', 'deductions', 'extraWithholding', 'pretax', 'nyAllowances', 'nyExtra'].map((k) => [k, Number(pay[k]) || 0]),
    )
    if (Object.values(numbers).some((n) => n < 0)) return setError("Amounts can't be negative.")
    setBusy(true)
    const problem = await data.actions.saveEmployee(e, { ...pay, ...numbers, nyAllowances: Math.round(numbers.nyAllowances) })
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }

  const rate = Number(pay.hourlyRate) || 0
  const none = e.payType === 'none' // on the schedule only, like Nema
  // "Remove from team…" swaps this pop-up for the remove choices (Cancel comes back).
  if (removing) return <RemovePerson employee={employee} data={data} onCancel={() => setRemoving(false)} onDone={onClose} />
  return (
    <Modal
      title={employee.id ? employee.name : 'Add person'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          {employee.id && !self && (
            <button type="button" className="btn btn-outline-danger me-auto pe-remove" onClick={() => setRemoving(true)}>Remove from team…</button>
          )}
          <button type="button" className="btn btn-outline-secondary pe-foot" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-brand pe-foot" disabled={busy} onClick={save}>Save</button>
        </>
      }
    >
      <div className="row g-2">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="pe-name">Full name</label>
          <input id="pe-name" className="form-control" value={e.name} onChange={setField('name')} />
        </div>
        {!none && (
          <div className="col-sm-6">
            <label className="form-label" htmlFor="pe-email">Sign-in email</label>
            <input id="pe-email" type="email" className="form-control" value={e.email} onChange={setField('email')} />
          </div>
        )}
        <div className="col-sm-6">
          <label className="form-label" htmlFor="pe-pos">Position</label>
          <input id="pe-pos" className="form-control" list="pe-positions" value={e.position} onChange={setField('position')} />
          <datalist id="pe-positions">{data.settings.positions.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        {(data.settings.groups ?? []).length > 0 && (
          <div className="col-sm-6">
            <label className="form-label" htmlFor="pe-group">Group</label>
            <select id="pe-group" className="form-select" value={e.group ?? ''} onChange={(ev) => setE({ ...e, group: ev.target.value || null })}>
              <option value="">No group</option>
              {data.settings.groups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
              {e.group && !data.settings.groups.some((g) => g.name === e.group) && <option value={e.group}>{e.group}</option>}
            </select>
          </div>
        )}
        <div className="col-sm-6">
          <label className="form-label" htmlFor="pe-start">Start date</label>
          <input id="pe-start" type="date" className="form-control" value={e.startedOn ?? ''} onChange={setField('startedOn')} />
        </div>
        <div className="col-sm-6 d-flex align-items-end gap-3 flex-wrap">
          <PillToggle checked={e.active} disabled={self} onChange={(on) => setE({ ...e, active: on })}>Active</PillToggle>
          {!none && (
            <PillToggle checked={e.isManager} disabled={self} onChange={(on) => setE({ ...e, isManager: on })}>Manager</PillToggle>
          )}
        </div>
        {self && <p className="tm-muted small mb-0">You can't remove your own manager access or deactivate yourself.</p>}
      </div>
      {employee.id && !none && <Contact priv={data.privateById[employee.id]} settings={data.settings} />}
      {employee.id && !none && f.timeClock && f.kioskClock && <KioskPin employee={employee} />}

      {f.payRates && (
      <>
      <h3 className="tm-h3">Pay</h3>
      <div className="row g-2">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="pe-type">Paid by</label>
          <select id="pe-type" className="form-select" value={e.payType} onChange={setField('payType')}>
            <option value="hourly">The hour</option>
            <option value="commission">Commission</option>
            {!self && <option value="none">Not paid here: schedule only</option>}
          </select>
          {none && <div className="form-text">Shows on the schedule so everyone sees their days. No email, login, clock or pay.</div>}
        </div>
        {e.payType === 'hourly' && (
          <div className="col-sm-6">
            <label className="form-label" htmlFor="pe-rate">Hourly rate ($)</label>
            <input id="pe-rate" type="number" min="0" step="0.25" className="form-control" value={pay.hourlyRate} onChange={setPayField('hourlyRate')} />
            {rate > 0 && rate < NY_MIN_WAGE && <div className="tm-warn small mt-1">Below the New York minimum wage ({money(NY_MIN_WAGE)}/hr).</div>}
          </div>
        )}
        {!none && (
          <div className="col-sm-6">
            <label className="form-label" htmlFor="pe-pretax">Pre-tax deductions per paycheck ($)</label>
            <input id="pe-pretax" type="number" min="0" step="1" className="form-control" value={pay.pretax} onChange={setPayField('pretax')} />
            <div className="form-text">401(k) and similar. Lowers income tax only.</div>
          </div>
        )}
      </div>

      {!none && (
        <>
          <h3 className="tm-h3">Federal W-4</h3>
          <div className="row g-2">
            <div className="col-sm-6">
              <label className="form-label" htmlFor="pe-fs">Step 1(c) filing status</label>
              <select id="pe-fs" className="form-select" value={pay.filingStatus} onChange={setPayField('filingStatus')}>
                <option value="single">Single or married filing separately</option>
                <option value="married">Married filing jointly</option>
                <option value="head">Head of household</option>
              </select>
            </div>
            <div className="col-sm-6 d-flex align-items-end">
              <PillToggle checked={pay.step2} onChange={(on) => setPay({ ...pay, step2: on })}>Step 2 box checked (two jobs)</PillToggle>
            </div>
            <Money id="pe-dep" label="Step 3: dependents (total $)" value={pay.dependents} onChange={setPayField('dependents')} />
            <Money id="pe-oth" label="Step 4(a): other income ($ a year)" value={pay.otherIncome} onChange={setPayField('otherIncome')} />
            <Money id="pe-ded" label="Step 4(b): deductions ($ a year)" value={pay.deductions} onChange={setPayField('deductions')} />
            <Money id="pe-ext" label="Step 4(c): extra withholding ($ per paycheck)" value={pay.extraWithholding} onChange={setPayField('extraWithholding')} />
          </div>

          <h3 className="tm-h3">New York IT-2104</h3>
          <div className="row g-2">
            <div className="col-sm-6">
              <label className="form-label" htmlFor="pe-nys">Status</label>
              <select id="pe-nys" className="form-select" value={pay.nyStatus} onChange={setPayField('nyStatus')}>
                <option value="single">Single or head of household</option>
                <option value="married">Married</option>
              </select>
            </div>
            <div className="col-sm-6">
              <label className="form-label" htmlFor="pe-nya">Allowances (line 1)</label>
              <input id="pe-nya" type="number" min="0" step="1" className="form-control" value={pay.nyAllowances} onChange={setPayField('nyAllowances')} />
            </div>
            <Money id="pe-nyx" label="Extra state withholding ($ per paycheck)" value={pay.nyExtra} onChange={setPayField('nyExtra')} />
            <div className="col-sm-6 d-flex align-items-end">
              <PillToggle checked={pay.nycResident} onChange={(on) => setPay({ ...pay, nycResident: on })}>Lives in New York City</PillToggle>
            </div>
          </div>
          <p className="tm-muted small mt-3 mb-0">
            Used only for the paycheck estimate. Bank details for direct deposit go in the payroll service, never here.
          </p>
        </>
      )}
      </>
      )}
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </Modal>
  )
}

// Someone left: usually just mark them not active (their hours stay on record
// for payroll and taxes), or delete them and everything about them for good.
// The PIN this person types on the kiosk. Managers set or clear it; it is never shown again.
function KioskPin({ employee }) {
  const [has, setHas] = useState(null)
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    kioskPinOwners().then((r) => setHas(r.owners.has(employee.id)))
  }, [employee.id])
  const save = async () => {
    setBusy(true)
    const problem = await setKioskPin(employee.id, pin)
    setBusy(false)
    setMsg(problem ? problem : 'PIN saved.')
    if (!problem) {
      setPin('')
      setHas(true)
    }
  }
  const clear = async () => {
    setBusy(true)
    const problem = await clearKioskPin(employee.id)
    setBusy(false)
    setMsg(problem ? problem : 'PIN removed.')
    if (!problem) setHas(false)
  }
  return (
    <>
      <h3 className="tm-h3">Kiosk PIN</h3>
      <div className="d-flex gap-2 flex-wrap align-items-center">
        <label className="visually-hidden" htmlFor="pe-pin">New PIN</label>
        <input id="pe-pin" className="form-control" style={{ maxWidth: 160 }} inputMode="numeric" autoComplete="off" maxLength={6} placeholder={has ? 'New PIN' : '4 to 6 digits'} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy || pin.length < 4} onClick={save}>{has ? 'Change PIN' : 'Set PIN'}</button>
        {has && <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={clear}>Remove PIN</button>}
        <small className="tm-muted">{has === null ? '' : has ? 'Has a PIN.' : 'No PIN yet.'}</small>
      </div>
      {msg && <p className="small mb-0 mt-1" role="status">{msg}</p>}
    </>
  )
}

function RemovePerson({ employee, data, onCancel, onDone }) {
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pay = data.payById[employee.id]

  const finish = async (fn) => {
    setBusy(true)
    const problem = await fn()
    setBusy(false)
    if (problem) setError(problem)
    else onDone()
  }
  const deactivate = () => finish(() => data.actions.saveEmployee({ ...employee, active: false }, pay ?? NEW_PAY))
  const destroy = () => finish(() => data.actions.deleteEmployee(employee.id))

  return (
    <Modal title={`Remove ${employee.name}`} onClose={onCancel}>
      <h3 className="tm-h3 mt-0 pt-0 border-0">They left (recommended)</h3>
      <p className="small">
        They can't sign in to the team page anymore and drop off the schedule, but their hours and pay history stay for payroll
        and taxes. New York requires keeping payroll records for 6 years. You can make them active again later.
      </p>
      <button type="button" className="btn btn-brand" disabled={busy || !employee.active} onClick={deactivate}>
        {employee.active ? 'Mark as not active' : 'Already not active'}
      </button>

      <h3 className="tm-h3">Delete for good</h3>
      <p className="small">
        Deletes {employee.name} with <b>all</b> their shifts, clock-ins, hours, time off and pay settings. This can't be undone.
        Only for someone added by mistake, or once you have their records saved elsewhere (Hours &amp; pay → Timesheet → Download).
      </p>
      <label className="form-label small" htmlFor="rm-name">Type their name to confirm: <b>{employee.name}</b></label>
      <input id="rm-name" className="form-control mb-2" value={typed} onChange={(e) => setTyped(e.target.value)} />
      <button type="button" className="btn btn-danger" disabled={busy || typed.trim().toLowerCase() !== employee.name.trim().toLowerCase()} onClick={destroy}>
        Delete for good
      </button>
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </Modal>
  )
}

function Money({ id, label, value, onChange }) {
  return (
    <div className="col-sm-6">
      <label className="form-label" htmlFor={id}>{label}</label>
      <input id={id} type="number" min="0" step="1" className="form-control" value={value} onChange={onChange} />
    </div>
  )
}

// Phone, emergency contact and the location notice. Each person fills these in
// themselves (⚙️ Settings), so managers only see them here.
function Contact({ priv, settings }) {
  const acked = noticeAcked(priv, settings)
  return (
    <div className="tm-contact">
      <h3 className="tm-h3">Contact</h3>
      <div>Phone: {priv?.phone ? <a href={`tel:${priv.phone}`}>{priv.phone}</a> : <span className="tm-muted">not added yet</span>}</div>
      <div>
        Emergency contact:{' '}
        {priv?.emergencyName || priv?.emergencyPhone ? (
          <>
            {priv.emergencyName} {priv.emergencyPhone && <a href={`tel:${priv.emergencyPhone}`}>{priv.emergencyPhone}</a>}
          </>
        ) : (
          <span className="tm-muted">not added yet</span>
        )}
      </div>
      <div>
        Location notice:{' '}
        {acked ? <span className="tm-chip approved">Read {dayLabel(dateKey(new Date(priv.noticeAckAt)))}</span> : <span className="tm-chip pending">Not read yet</span>}
      </div>
      <p className="tm-muted small mb-0">They add these themselves in ⚙️ Settings.</p>
    </div>
  )
}
