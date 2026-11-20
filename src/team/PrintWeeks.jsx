import { formatHours } from './paycheck.js'
import { dayLabel } from './format.js'

// The printed version of a Reports table: one table per week (a two-week pay period prints as two tables), so seven day
// columns fit the page and times stay on one line ("10:28a–4p"). Only shown when printing; the screen keeps one wide table.
//   sections: [{ name, rows }] from groupRows
//   day(row, i): { lines: [text], minutes } for day i of `days`
//   overtime: split each week's total into regular and overtime (after 40 hours), like the timesheet

const OT_AFTER = 40 * 60

export const shortTime = (iso) => {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`
}
export const shortMinutes = (min) => {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`
}

export default function PrintWeeks({ days, sections, day, staffNo = false, overtime = false }) {
  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7).map((d, j) => ({ d, i: i + j })))
  const all = sections.flatMap((s) => s.rows)
  const weekMinutes = (r, week) => week.reduce((sum, { i }) => sum + day(r, i).minutes, 0)
  const split = (min) => ({ regular: Math.min(min, OT_AFTER), overtime: Math.max(0, min - OT_AFTER) })
  const sum = (rows, fn) => rows.reduce((total, r) => total + fn(r), 0)
  const span = 2 + (staffNo ? 1 : 0) + (overtime ? 2 : 0) + 7
  return (
    <div className="pw print-only">
      {weeks.map((week, w) => (
        <table key={week[0].d} className="pw-table">
          <caption>{weeks.length > 1 ? `Week ${w + 1}: ` : ''}{dayLabel(week[0].d)} to {dayLabel(week.at(-1).d)}</caption>
          <thead>
            <tr>
              <th scope="col" className="pw-name">Name</th>
              {staffNo && <th scope="col" className="pw-num">No.</th>}
              <th scope="col" className="pw-num">Total</th>
              {overtime && <th scope="col" className="pw-num">Regular</th>}
              {overtime && <th scope="col" className="pw-num">Overtime</th>}
              {week.map(({ d }) => <th key={d} scope="col">{dayLabel(d)}</th>)}
            </tr>
          </thead>
          {sections.map((sec) => (
            <tbody key={sec.name || 'all'}>
              {sec.name && <tr className="pw-group"><th colSpan={span}>{sec.name}</th></tr>}
              {sec.rows.map((r) => {
                const total = weekMinutes(r, week)
                const { regular, overtime: ot } = split(total)
                return (
                  <tr key={r.e.id}>
                    <th scope="row" className="pw-name">{r.e.name}</th>
                    {staffNo && <td className="pw-num">{r.e.staffNo ?? ''}</td>}
                    <td className="pw-num"><b>{formatHours(total)}</b></td>
                    {overtime && <td className="pw-num">{formatHours(regular)}</td>}
                    {overtime && <td className="pw-num">{formatHours(ot)}</td>}
                    {week.map(({ d, i }) => {
                      const cell = day(r, i)
                      return (
                        <td key={d} className="pw-day">
                          {cell.lines.map((line, k) => <div key={k}>{line}</div>)}
                          {cell.minutes > 0 && <b>{formatHours(cell.minutes)}</b>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          ))}
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {staffNo && <td />}
              <td className="pw-num"><b>{formatHours(sum(all, (r) => weekMinutes(r, week)))}</b></td>
              {overtime && <td className="pw-num">{formatHours(sum(all, (r) => split(weekMinutes(r, week)).regular))}</td>}
              {overtime && <td className="pw-num">{formatHours(sum(all, (r) => split(weekMinutes(r, week)).overtime))}</td>}
              {week.map(({ d, i }) => <td key={d} className="pw-num">{formatHours(sum(all, (r) => day(r, i).minutes))}</td>)}
            </tr>
          </tfoot>
        </table>
      ))}
    </div>
  )
}
