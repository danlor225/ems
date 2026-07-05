// ============================================================
//  Exports des résultats : CSV, Excel (ExcelJS), PDF (jsPDF).
//  Les libs lourdes sont importées DYNAMIQUEMENT (lazy) : elles
//  ne pèsent sur le bundle que si l'utilisateur exporte.
// ============================================================
import type { EvaluationResults } from './resultsApi'

export interface ExportMeta {
  code?: string | null
  subject?: string
  academicSession?: string | null
  author?: string | null
}

const HEADERS = [
  'Nom',
  'Prénom',
  'Bonnes',
  'Mauvaises',
  'Note',
  'Total',
  'Temps (s)',
  'Statut',
  'Observation',
]

function rowsOf(r: EvaluationResults) {
  const total = r.evaluation.totalPoints
  return r.students.map((s) => [
    s.lastName,
    s.firstName,
    s.correctCount,
    s.incorrectCount,
    s.note,
    total,
    s.timeSpentSeconds ?? '',
    s.status,
    s.observation,
  ])
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function fileBase(meta: ExportMeta) {
  return `resultats-${meta.code ?? 'evaluation'}`
}

// ---------- CSV ----------
export function exportCsv(r: EvaluationResults, meta: ExportMeta) {
  const escape = (c: unknown) => `"${String(c).replace(/"/g, '""')}"`
  const lines = [HEADERS, ...rowsOf(r)]
    .map((row) => row.map(escape).join(';'))
    .join('\r\n')
  // BOM pour les accents dans Excel
  download(
    new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8' }),
    `${fileBase(meta)}.csv`,
  )
}

// ---------- Excel (ExcelJS, styles + couleurs EMS) ----------
export async function exportExcel(r: EvaluationResults, meta: ExportMeta) {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Résultats')

  ws.mergeCells(1, 1, 1, HEADERS.length)
  const titleCell = ws.getCell('A1')
  titleCell.value = `EMS — ${r.evaluation.title}`
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } }

  ws.mergeCells(2, 1, 2, HEADERS.length)
  ws.getCell('A2').value = [
    meta.subject,
    meta.academicSession,
    new Date().toLocaleDateString('fr-FR'),
  ]
    .filter(Boolean)
    .join('  ·  ')

  ws.addRow([])
  const headerRow = ws.addRow(HEADERS)
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' },
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  })
  rowsOf(r).forEach((row) => ws.addRow(row))
  ws.columns.forEach((col) => {
    col.width = 16
  })

  const buffer = await wb.xlsx.writeBuffer()
  download(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${fileBase(meta)}.xlsx`,
  )
}

// ---------- PDF (jsPDF + autotable) ----------
export async function exportPdf(r: EvaluationResults, meta: ExportMeta) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF()
  const total = r.evaluation.totalPoints
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // En-tête
  doc.setFontSize(20)
  doc.setTextColor('#1E3A8A')
  doc.text('EMS', 14, 18)
  doc.setFontSize(12)
  doc.setTextColor('#0F172A')
  doc.text(r.evaluation.title, 14, 26)
  doc.setFontSize(9)
  doc.setTextColor('#64748B')
  doc.text(
    [meta.subject, meta.academicSession, new Date().toLocaleDateString('fr-FR')]
      .filter(Boolean)
      .join('   ·   '),
    14,
    32,
  )
  doc.text(
    `Participants : ${r.stats.participants}    Moyenne : ${r.stats.average}/${total}    Réussite : ${r.stats.successRate}%`,
    14,
    38,
  )

  autoTable(doc, {
    startY: 44,
    head: [['Nom', 'Prénom', 'Bonnes', 'Mauvaises', 'Note', 'Statut']],
    body: r.students.map((s) => [
      s.lastName,
      s.firstName,
      s.correctCount,
      s.incorrectCount,
      `${s.note} / ${total}`,
      s.status,
    ]),
    headStyles: { fillColor: [29, 78, 216], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
    didDrawPage: (d) => {
      doc.setFontSize(8)
      doc.setTextColor('#94A3B8')
      doc.text(
        `EMS · Evaluation Management System · Page ${d.pageNumber}`,
        14,
        pageHeight - 8,
      )
      doc.text('Signature : ____________', pageWidth - 70, pageHeight - 8)
    },
  })

  doc.save(`${fileBase(meta)}.pdf`)
}
