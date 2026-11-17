// Builds and downloads a PDF of one or more tables. The PDF libraries are big, so they are
// loaded only when someone presses Download PDF.
//
// tables: [{ heading?, head: [...], body: [[...]], boldRows?: [index], foot?: [...] }]
export async function downloadPdf({ fileName, title, subtitle, notes = [], tables, landscape = false }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'letter' })
  const margin = 40
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(title, margin, 52)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(90, 82, 73)
  doc.text(subtitle, margin, 72)
  let y = 72
  for (const note of notes) {
    y += 15
    doc.text(note, margin, y)
  }
  y += 22
  doc.setTextColor(42, 36, 32)

  for (const t of tables) {
    if (t.heading) {
      // Start a new page when a heading would be stranded at the bottom.
      if (y > height - 110) {
        doc.addPage()
        y = 50
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(t.heading, margin, y)
      y += 8
    }
    const bold = new Set(t.boldRows ?? [])
    autoTable(doc, {
      startY: y,
      head: [t.head],
      body: t.body,
      foot: t.foot ? [t.foot] : undefined,
      margin: { left: margin, right: margin, bottom: 50 },
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 5, textColor: [42, 36, 32] },
      headStyles: { fillColor: [200, 71, 46], textColor: 255 },
      footStyles: { fillColor: [246, 213, 128], textColor: [42, 36, 32] },
      alternateRowStyles: { fillColor: [255, 247, 236] },
      didParseCell: (hook) => {
        if (hook.section === 'body' && bold.has(hook.row.index)) {
          hook.cell.styles.fontStyle = 'bold'
          hook.cell.styles.fillColor = [234, 219, 200]
        }
      },
    })
    y = doc.lastAutoTable.finalY + 26
  }

  // Page numbers and the date it was made.
  const pages = doc.internal.getNumberOfPages()
  const made = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 110, 100)
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.text(`Made with WiseShift · ${made}`, margin, height - 24)
    doc.text(`Page ${i} of ${pages}`, width - margin, height - 24, { align: 'right' })
  }
  doc.save(fileName)
}
