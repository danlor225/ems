// ============================================================
//  Export global des rapports : Excel (ExcelJS) et PDF (jsPDF).
//  Libs importées DYNAMIQUEMENT (hors bundle initial).
// ============================================================
import type { Aggregate, ReportsData } from './reportsApi'

// Clés de ReportsData dont la valeur est un tableau d'Aggregate
// (exclut `overview`, qui est un Aggregate unique) => data[key] est un Aggregate[].
type ReportListKey = {
  [K in keyof ReportsData]: ReportsData[K] extends Aggregate[] ? K : never
}[keyof ReportsData]

const SECTIONS: { key: ReportListKey; title: string; head: string }[] = [
  { key: 'bySubject', title: 'Par matière', head: 'Matière' },
  { key: 'byGroup', title: 'Par groupe', head: 'Groupe' },
  { key: 'timeline', title: 'Par période', head: 'Période' },
]

const COLS = ['Participants', 'Moyenne (%)', 'Réussite (%)']

function rowsOf(items: Aggregate[]) {
  return items.map((a) => [a.label, a.participants, a.average, a.successRate])
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportReportsExcel(data: ReportsData) {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
  const wb = new ExcelJS.Workbook()

  for (const section of SECTIONS) {
    const ws = wb.addWorksheet(section.title)
    const header = ws.addRow([section.head, ...COLS])
    header.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1D4ED8' },
      }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    })
    rowsOf(data[section.key]).forEach((r) => ws.addRow(r))
    ws.columns.forEach((c) => {
      c.width = 18
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  download(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'rapport-ems.xlsx',
  )
}

export async function exportReportsPdf(data: ReportsData) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFontSize(20)
  doc.setTextColor('#1E3A8A')
  doc.text('EMS — Rapport analytique', 14, 18)
  doc.setFontSize(10)
  doc.setTextColor('#64748B')
  doc.text(
    `Édité le ${new Date().toLocaleDateString('fr-FR')}   ·   Global : ` +
      `${data.overview.participants} participants, moyenne ${data.overview.average}%, ` +
      `réussite ${data.overview.successRate}%`,
    14,
    25,
  )

  let startY = 32
  for (const section of SECTIONS) {
    autoTable(doc, {
      startY,
      head: [[section.head, ...COLS]],
      body: rowsOf(data[section.key]),
      headStyles: { fillColor: [29, 78, 216], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: 14, right: 14 },
      didDrawPage: (d) => {
        doc.setFontSize(11)
        doc.setTextColor('#0F172A')
        doc.text(section.title, 14, d.settings.startY - 3)
      },
    })
    // Position de la table suivante.
    const last = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable
    startY = (last?.finalY ?? startY) + 12
    if (startY > pageHeight - 40) {
      doc.addPage()
      startY = 20
    }
  }

  doc.save('rapport-ems.pdf')
}
