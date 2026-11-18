import { estimatePaycheck, formatHours, grossPay } from './paycheck.js'
import { money } from './format.js'
import { TAX_YEAR } from './taxRates.js'

// The paycheck estimate for one pay period.
export default function Paycheck({ employee, pay, hours, isMe }) {
  if (employee.payType === 'commission') {
    return <section className="tm-card"><h2>Paycheck estimate</h2><p className="tm-muted mb-0">Paid by commission: commission pay isn't calculated here yet.</p></section>
  }
  if (!pay || !pay.hourlyRate) {
    return (
      <section className="tm-card">
        <h2>Paycheck estimate</h2>
        <p className="tm-muted mb-0">{isMe ? "Your manager hasn't added your pay rate yet." : 'Add a pay rate on the Team tab to see an estimate.'}</p>
      </section>
    )
  }
  const { regularPay, overtimePay, gross } = grossPay(hours, pay.hourlyRate)
  const estimate = estimatePaycheck(gross, pay)
  return (
    <section className="tm-card tm-paycheck">
      <h2>Paycheck estimate</h2>
      <div className="tm-row"><span>Regular {formatHours(hours.regular)} hrs × {money(pay.hourlyRate)}</span><span>{money(regularPay)}</span></div>
      {hours.overtime > 0 && <div className="tm-row"><span>Overtime {formatHours(hours.overtime)} hrs × {money(pay.hourlyRate * 1.5)}</span><span>{money(overtimePay)}</span></div>}
      <div className="tm-row tm-strong"><span>Gross pay</span><span>{money(gross)}</span></div>
      {estimate.lines.map((l) => (
        <div key={l.key} className="tm-row tm-minus"><span>{l.label}</span><span>−{money(l.amount)}</span></div>
      ))}
      <div className="tm-row tm-net"><span>Estimated take-home</span><span>{money(estimate.net)}</span></div>
      <p className="tm-muted small mb-0">
        An estimate using {TAX_YEAR} tax tables and the W-4 and IT-2104 on file. Your real pay stub from payroll may differ by a few dollars.
      </p>
    </section>
  )
}
