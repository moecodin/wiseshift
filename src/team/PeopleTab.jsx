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
import { tr } from './i18n.js'

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
        <h2 className="sc-h">{tr("Team", "Equipo")} <small className="mg-sum">{people.filter((e) => e.active).length} active</small></h2>
        <button type="button" className="btn btn-brand btn-sm" data-search="add-person" onClick={() => setEditing({ name: '', email: '', position: '', isManager: false, payType: 'hourly', active: true })}>{tr("+ Add person", "+ Agregar persona")}</button>
      </div>
      <div className="pt-list">
      {people.map((e) => {
        const pay = data.payById[e.id]
        const rate = scheduleOnly(e) ? tr('Schedule only', 'Solo horario') : !f.payRates ? '' : e.payType === 'commission' ? tr('Commission', 'Comisión') : pay?.hourlyRate ? `${money(pay.hourlyRate)}/hr` : tr('No rate', 'Sin tarifa')
        return (
          <button key={e.id} type="button" className={`sc-row person pt-person ${e.active ? '' : 'inactive'}`} onClick={() => onPerson(e.id)}>
            <Avatar employee={e} size={44} />
            <span className="sc-body">
              <b>
                {e.name}
                {e.isManager && <span className="pt-chip">{tr("Manager", "Gerente")}</span>}
                {!e.active && <span className="pt-chip off">{tr("Not active", "Inactivo")}</span>}
              </b>
              <small>{e.position || tr('No position', 'Sin puesto')}</small>
              <small>{scheduleOnly(e) ? tr('No login', 'Sin acceso') : e.email}</small>
            </span>
            <span className="sc-hrs">{rate}</span>
          </button>
        )
      })}
      </div>
      <details className="pt-help">
        <summary>{tr("How to give someone a login", "Cómo darle acceso a alguien")}</summary>
        <ol>
          <li>{tr("Add them here with the email they'll sign in with.", "Agrégalos aquí con el correo con el que entrarán.")}</li>
          <li>
            {tr('Send them your WiseShift link. They tap', 'Mándales tu enlace de WiseShift. Tocan')} <b>{tr("First time here, or forgot your password?", "¿Primera vez aquí, u olvidaste tu contraseña?")}</b>{tr(', type that email, enter the code we email them, and choose their own password. Their login only opens their own WiseShift pages.', ', escriben ese correo, ponen el código que les enviamos y eligen su propia contraseña. Su acceso solo abre sus propias páginas de WiseShift.')}
          </li>
        </ol>
        <p className="tm-muted small">
          {tr("Clocking in or out saves the phone's location. Everyone is asked to read the location notice in the app and tap", 'Marcar entrada o salida guarda la ubicación del teléfono. Se le pide a todos leer el aviso de ubicación en la app y tocar')}
          <b> {tr("I've read this", "Ya lo leí")}</b> {tr('(New York law); see who has in ⚙️ Settings → Business. Also post it where staff can see it.', '(ley de Nueva York); mira quién ya lo hizo en ⚙️ Ajustes → Negocio. También ponlo donde el personal lo vea.')}
        </p>
        <p className="tm-muted small mb-0">{tr("Someone who leaves: open them and press", "Si alguien se va: ábrelo y presiona")} <b>{tr("Remove from team…", "Quitar del equipo…")}</b>.</p>
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
    if (!e.name.trim()) return setError(tr('Type their name.', 'Escribe su nombre.'))
    const none = e.payType === 'none'
    if (!none && !/^\S+@\S+\.\S+$/.test(e.email.trim())) return setError(tr('Type the email they sign in with.', 'Escribe el correo con el que entra.'))
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
      title={employee.id ? employee.name : tr('Add person', 'Agregar persona')}
      size="lg"
      onClose={onClose}
      footer={
        <>
          {employee.id && !self && (
            <button type="button" className="btn btn-outline-danger me-auto pe-remove" onClick={() => setRemoving(true)}>{tr("Remove from team…", "Quitar del equipo…")}</button>
          )}
          <button type="button" className="btn btn-outline-secondary pe-foot" onClick={onClose}>{tr("Cancel", "Cancelar")}</button>
          <button type="button" className="btn btn-brand pe-foot" disabled={busy} onClick={save}>{tr("Save", "Guardar")}</button>
        </>
      }
    >
      <div className="row g-2">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="pe-name">{tr("Full name", "Nombre completo")}</label>
          <input id="pe-name" className="form-control" value={e.name} onChange={setField('name')} />
        </div>
        {!none && (
          <div className="col-sm-6">
            <label className="form-label" htmlFor="pe-email">{tr("Sign-in email", "Correo para entrar")}</label>
            <input id="pe-email" type="email" className="form-control" value={e.email} onChange={setField('email')} />
          </div>
        )}
        <div className="col-sm-6">
          <label className="form-label" htmlFor="pe-pos">{tr("Position", "Puesto")}</label>
          <input id="pe-pos" className="form-control" list="pe-positions" value={e.position} onChange={setField('position')} />
          <datalist id="pe-positions">{data.settings.positions.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        {(data.settings.groups ?? []).length > 0 && (
          <div className="col-sm-6">
            <label className="form-label" htmlFor="pe-group">{tr("Group", "Grupo")}</label>
            <select id="pe-group" className="form-select" value={e.group ?? ''} onChange={(ev) => setE({ ...e, group: ev.target.value || null })}>
              <option value="">{tr("No group", "Sin grupo")}</option>
              {data.settings.groups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
              {e.group && !data.settings.groups.some((g) => g.name === e.group) && <option value={e.group}>{e.group}</option>}
            </select>
          </div>
        )}
        <div className="col-sm-6">
          <label className="form-label" htmlFor="pe-start">{tr("Start date", "Fecha de inicio")}</label>
          <input id="pe-start" type="date" className="form-control" value={e.startedOn ?? ''} onChange={setField('startedOn')} />
        </div>
        {!none && data.settings.payrollReady && (
          <div className="col-sm-6">
            <label className="form-label" htmlFor="pe-payroll">{tr("Payroll ID", "ID de nómina")}</label>
            <input id="pe-payroll" className="form-control" maxLength={40} placeholder={tr('Their ID in your payroll service', 'Su ID en tu servicio de nómina')} value={pay.payrollId ?? ''} onChange={setPayField('payrollId')} />
          </div>
        )}
        <div className="col-sm-6 d-flex align-items-end gap-3 flex-wrap">
          <PillToggle checked={e.active} disabled={self} onChange={(on) => setE({ ...e, active: on })}>{tr("Active", "Activo")}</PillToggle>
          {!none && (
            <PillToggle checked={e.isManager} disabled={self} onChange={(on) => setE({ ...e, isManager: on })}>{tr("Manager", "Gerente")}</PillToggle>
          )}
        </div>
        {self && <p className="tm-muted small mb-0">{tr("You can't remove your own manager access or deactivate yourself.", "No puedes quitarte tu acceso de gerente ni desactivarte.")}</p>}
      </div>
      {employee.id && !none && <Contact priv={data.privateById[employee.id]} settings={data.settings} />}
      {employee.id && !none && f.timeClock && f.kioskClock && <KioskPin employee={employee} />}

      {f.payRates && (
      <>
      <h3 className="tm-h3">{tr("Pay", "Pago")}</h3>
      <div className="row g-2">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="pe-type">{tr("Paid by", "Pago por")}</label>
          <select id="pe-type" className="form-select" value={e.payType} onChange={setField('payType')}>
            <option value="hourly">{tr("The hour", "La hora")}</option>
            <option value="commission">{tr("Commission", "Comisión")}</option>
            {!self && <option value="none">{tr("Not paid here: schedule only", "Sin pago aquí: solo horario")}</option>}
          </select>
          {none && <div className="form-text">{tr("Shows on the schedule so everyone sees their days. No email, login, clock or pay.", "Aparece en el horario para que todos vean sus días. Sin correo, acceso, reloj ni pago.")}</div>}
        </div>
        {e.payType === 'hourly' && (
          <div className="col-sm-6">
            <label className="form-label" htmlFor="pe-rate">{tr("Hourly rate ($)", "Tarifa por hora ($)")}</label>
            <input id="pe-rate" type="number" min="0" step="0.25" className="form-control" value={pay.hourlyRate} onChange={setPayField('hourlyRate')} />
            {rate > 0 && rate < NY_MIN_WAGE && <div className="tm-warn small mt-1">Below the New York minimum wage ({money(NY_MIN_WAGE)}/hr).</div>}
          </div>
        )}
        {!none && (
          <div className="col-sm-6">
            <label className="form-label" htmlFor="pe-pretax">{tr("Pre-tax deductions per paycheck ($)", "Deducciones antes de impuestos por cheque ($)")}</label>
            <input id="pe-pretax" type="number" min="0" step="1" className="form-control" value={pay.pretax} onChange={setPayField('pretax')} />
            <div className="form-text">{tr("401(k) and similar. Lowers income tax only.", "401(k) y similares. Solo baja el impuesto sobre la renta.")}</div>
          </div>
        )}
      </div>

      {!none && (
        <>
          <h3 className="tm-h3">{tr("Federal W-4", "W-4 federal")}</h3>
          <div className="row g-2">
            <div className="col-sm-6">
              <label className="form-label" htmlFor="pe-fs">{tr("Step 1(c) filing status", "Estado civil para impuestos (paso 1c)")}</label>
              <select id="pe-fs" className="form-select" value={pay.filingStatus} onChange={setPayField('filingStatus')}>
                <option value="single">{tr("Single or married filing separately", "Soltero o casado declarando por separado")}</option>
                <option value="married">{tr("Married filing jointly", "Casado declarando en conjunto")}</option>
                <option value="head">{tr("Head of household", "Cabeza de familia")}</option>
              </select>
            </div>
            <div className="col-sm-6 d-flex align-items-end">
              <PillToggle checked={pay.step2} onChange={(on) => setPay({ ...pay, step2: on })}>{tr("Step 2 box checked (two jobs)", "Casilla del paso 2 marcada (dos trabajos)")}</PillToggle>
            </div>
            <Money id="pe-dep" label="Step 3: dependents (total $)" value={pay.dependents} onChange={setPayField('dependents')} />
            <Money id="pe-oth" label="Step 4(a): other income ($ a year)" value={pay.otherIncome} onChange={setPayField('otherIncome')} />
            <Money id="pe-ded" label="Step 4(b): deductions ($ a year)" value={pay.deductions} onChange={setPayField('deductions')} />
            <Money id="pe-ext" label="Step 4(c): extra withholding ($ per paycheck)" value={pay.extraWithholding} onChange={setPayField('extraWithholding')} />
          </div>

          <h3 className="tm-h3">New York IT-2104</h3>
          <div className="row g-2">
            <div className="col-sm-6">
              <label className="form-label" htmlFor="pe-nys">{tr("Status", "Estado")}</label>
              <select id="pe-nys" className="form-select" value={pay.nyStatus} onChange={setPayField('nyStatus')}>
                <option value="single">{tr("Single or head of household", "Soltero o cabeza de familia")}</option>
                <option value="married">{tr("Married", "Casado")}</option>
              </select>
            </div>
            <div className="col-sm-6">
              <label className="form-label" htmlFor="pe-nya">{tr("Allowances (line 1)", "Exenciones (línea 1)")}</label>
              <input id="pe-nya" type="number" min="0" step="1" className="form-control" value={pay.nyAllowances} onChange={setPayField('nyAllowances')} />
            </div>
            <Money id="pe-nyx" label="Extra state withholding ($ per paycheck)" value={pay.nyExtra} onChange={setPayField('nyExtra')} />
            <div className="col-sm-6 d-flex align-items-end">
              <PillToggle checked={pay.nycResident} onChange={(on) => setPay({ ...pay, nycResident: on })}>{tr("Lives in New York City", "Vive en la ciudad de Nueva York")}</PillToggle>
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
      <h3 className="tm-h3">{tr("Kiosk PIN", "PIN del quiosco")}</h3>
      <div className="d-flex gap-2 flex-wrap align-items-center">
        <label className="visually-hidden" htmlFor="pe-pin">{tr("New PIN", "PIN nuevo")}</label>
        <input id="pe-pin" className="form-control" style={{ maxWidth: 160 }} inputMode="numeric" autoComplete="off" maxLength={6} placeholder={has ? tr('New PIN', 'PIN nuevo') : tr('4 to 6 digits', 'De 4 a 6 dígitos')} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy || pin.length < 4} onClick={save}>{has ? tr('Change PIN', 'Cambiar PIN') : tr('Set PIN', 'Poner PIN')}</button>
        {has && <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={clear}>{tr("Remove PIN", "Quitar PIN")}</button>}
        <small className="tm-muted">{has === null ? '' : has ? tr('Has a PIN.', 'Tiene PIN.') : tr('No PIN yet.', 'Aún sin PIN.')}</small>
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
    <Modal title={tr(`Remove ${employee.name}`, `Quitar a ${employee.name}`)} onClose={onCancel}>
      <h3 className="tm-h3 mt-0 pt-0 border-0">{tr("They left (recommended)", "Se fue (recomendado)")}</h3>
      <p className="small">
        They can't sign in to the team page anymore and drop off the schedule, but their hours and pay history stay for payroll
        and taxes. New York requires keeping payroll records for 6 years. You can make them active again later.
      </p>
      <button type="button" className="btn btn-brand" disabled={busy || !employee.active} onClick={deactivate}>
        {employee.active ? tr('Mark as not active', 'Marcar como inactivo') : tr('Already not active', 'Ya está inactivo')}
      </button>

      <h3 className="tm-h3">{tr("Delete for good", "Borrar para siempre")}</h3>
      <p className="small">
        Deletes {employee.name} with <b>{tr("all", "todos")}</b> their shifts, clock-ins, hours, time off and pay settings. This can't be undone.
        Only for someone added by mistake, or once you have their records saved elsewhere (Hours &amp; pay → Timesheet → Download).
      </p>
      <label className="form-label small" htmlFor="rm-name">{tr("Type their name to confirm:", "Escribe su nombre para confirmar:")} <b>{employee.name}</b></label>
      <input id="rm-name" className="form-control mb-2" value={typed} onChange={(e) => setTyped(e.target.value)} />
      <button type="button" className="btn btn-danger" disabled={busy || typed.trim().toLowerCase() !== employee.name.trim().toLowerCase()} onClick={destroy}>
        {tr("Delete for good", "Borrar para siempre")}
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
      <h3 className="tm-h3">{tr("Contact", "Contacto")}</h3>
      <div>{tr('Phone', 'Teléfono')}: {priv?.phone ? <a href={`tel:${priv.phone}`}>{priv.phone}</a> : <span className="tm-muted">{tr("not added yet", "aún no agregado")}</span>}</div>
      <div>
        {tr('Emergency contact', 'Contacto de emergencia')}:{' '}
        {priv?.emergencyName || priv?.emergencyPhone ? (
          <>
            {priv.emergencyName} {priv.emergencyPhone && <a href={`tel:${priv.emergencyPhone}`}>{priv.emergencyPhone}</a>}
          </>
        ) : (
          <span className="tm-muted">{tr("not added yet", "aún no agregado")}</span>
        )}
      </div>
      <div>
        {tr('Location notice', 'Aviso de ubicación')}:{' '}
        {acked ? <span className="tm-chip approved">Read {dayLabel(dateKey(new Date(priv.noticeAckAt)))}</span> : <span className="tm-chip pending">{tr("Not read yet", "Aún no leído")}</span>}
      </div>
      <p className="tm-muted small mb-0">{tr("They add their phone and emergency contact themselves, on More → My profile.", "Cada persona agrega su teléfono y contacto de emergencia en Más → Mi perfil.")}</p>
    </div>
  )
}
