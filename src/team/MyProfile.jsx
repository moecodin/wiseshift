import { useMemo } from 'react'
import { formatHours, grossPay, payPeriodOf, periodHours, scheduleWeekOf } from './paycheck.js'
import { dayLabel, money, rangeLabel, scheduleOnly, shiftTimes } from './format.js'
import { useFeatures } from './features.js'
import { MyColor, MyContact } from './SettingsPanel.jsx'
import Avatar from './Avatar.jsx'

// "My profile", for everyone: who you are as the team sees you, your own numbers for this pay period, this week's shifts,
// your badge color and your phone and emergency contact (the two things you can change). Name, position and pay are set by a manager.
export default function MyProfile({ data, me, onSettings }) {
  const f = useFeatures()
  const es = data.lang === 'es'
  const now = useMemo(() => new Date(), [])
  const mine = data.employees.find((e) => e.id === me.id) ?? me
  const none = scheduleOnly(mine)
  const period = payPeriodOf(now)
  const week = scheduleWeekOf(now)
  const hours = periodHours(data.punches, me.id, period, now)
  const pay = data.payById[me.id]
  const estimate = f.payRates && pay?.hourlyRate ? grossPay(hours, pay.hourlyRate).gross : null
  const shifts = data.shifts.filter((s) => s.employeeId === me.id && week.includes(s.date)).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
  return (
    <div className="tm-narrow desk pf">
      <header className="pf-head">
        <Avatar employee={mine} size={64} />
        <div className="pf-who">
          <h2>{mine.name}{mine.isManager && <span className="pt-chip">{es ? 'Gerente' : 'Manager'}</span>}</h2>
          <p>{[mine.position || (es ? 'Sin puesto' : 'No position'), mine.group, mine.startedOn && `${es ? 'Desde' : 'Started'} ${dayLabel(mine.startedOn)}`, mine.staffNo && `${es ? 'N.º' : 'Staff no.'} ${mine.staffNo}`].filter(Boolean).join(' · ')}</p>
        </div>
      </header>
      <p className="tm-muted pf-note">{es ? 'Tu nombre, puesto y pago los cambia un gerente.' : 'A manager sets your name, position and pay. You can change your color and contact details below.'}</p>

      {f.timeClock && !none && (
        <section className="pf-strip" aria-label={es ? 'Este período' : 'This pay period'}>
          <div><small>{es ? 'Horas este período' : 'Hours this pay period'}</small><b>{formatHours(hours.total)}</b><span>{rangeLabel(period)}</span></div>
          <div><small>{es ? 'Horas extra' : 'Overtime'}</small><b>{formatHours(hours.overtime)}</b><span>{es ? 'después de 40 por semana' : 'after 40 hours a week'}</span></div>
          {estimate !== null && <div><small>{es ? 'Pago estimado' : 'Paycheck estimate'}</small><b>{money(estimate)}</b><span>{es ? 'antes de impuestos' : 'before tax'}</span></div>}
        </section>
      )}

      <section className="pf-sec">
        <h3 className="tm-h3">{es ? 'Esta semana' : 'This week'}</h3>
        {shifts.length ? (
          <ul className="pf-list">
            {shifts.map((s) => <li key={s.id}><span>{dayLabel(s.date)}</span><b>{shiftTimes(s)}</b><small>{[s.title, f.roles && s.role].filter(Boolean).join(' · ')}</small></li>)}
          </ul>
        ) : <p className="tm-muted">{es ? 'Sin turnos esta semana.' : 'No shifts this week.'}</p>}
      </section>

      <MyColor data={data} me={me} />
      <MyContact data={data} me={me} />
      <button type="button" className="tm-link small" onClick={onSettings}>{es ? 'Ajustes: idioma, avisos, contraseña' : 'Settings: language, notifications, password'}</button>
    </div>
  )
}
