import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface PDFExportOptions {
  title: string
  subtitle?: string
  columns: string[]
  rows: (string | number)[][]
  fileName: string
}

export function exportTableToPDF({ title, subtitle, columns, rows, fileName }: PDFExportOptions) {
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text(title, 14, 18)

  if (subtitle) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(subtitle, 14, 25)
  }

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: subtitle ? 30 : 24,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] }, // indigo-600, tono del primary
  })

  doc.save(fileName)
}
