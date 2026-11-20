import { useState } from 'react'
import { moveDays, payPeriodOf } from './paycheck.js'
import { rangeLabel, useNow } from './format.js'
import { Timesheet } from './HoursTab.jsx'
import ExportHours from './ExportHours.jsx'
import Icon from './Icon.jsx'

// Reports (managers): everyone's hours for a pay period as a timesheet, with Print and the payroll download.
export default function ReportsTab({ data, period, onPeriod, focus }) {
  const now = useNow()
  const [exporting, setExporting] = useState(false)
  const current = payPeriodOf(now)[0] === period[0]
  return (
    <div>
      <div className="tm-toolbar">
        <div className="tm-weeknav nav-center">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPeriod(moveDays(period, -1))} aria-label="Pay period before"><Icon name="left" /></button>
          <b>{rangeLabel(period)}</b>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPeriod(moveDays(period, 1))} aria-label="Pay period after"><Icon name="right" /></button>
          {!current && <button type="button" className="btn btn-link btn-sm" onClick={() => onPeriod(payPeriodOf(new Date()))}>This pay period</button>}
        </div>
        <button type="button" className="btn btn-brand btn-sm ex-btn desk-only" data-search="export" onClick={() => setExporting(true)}>Export hours…</button>
      </div>
      <Timesheet data={data} period={period} now={now} focus={focus} />
      <p className="ex-note">Exports are available on a computer.</p>
      {exporting && <ExportHours data={data} now={now} onClose={() => setExporting(false)} />}
    </div>
  )
}
