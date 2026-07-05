// ============================================================
//  Génération du PDF d'un certificat de réussite (côté client).
//  jsPDF + qrcode importés DYNAMIQUEMENT (hors bundle initial).
//  Le QR encode l'URL publique de vérification.
// ============================================================
import type { CertificateRow } from './certificatesApi'

// Couleurs officielles EMS.
const DARK_BLUE = '#1E3A8A'
const PRIMARY = '#1D4ED8'
const INK = '#0F172A'
const MUTED = '#64748B'

export function verifyUrl(code: string): string {
  return `${window.location.origin}/verifier/${encodeURIComponent(code)}`
}

export async function generateCertificatePdf(cert: CertificateRow) {
  const { jsPDF } = await import('jspdf')
  const QRCode = await import('qrcode')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // Cadre décoratif
  doc.setDrawColor(DARK_BLUE)
  doc.setLineWidth(1.5)
  doc.rect(8, 8, W - 16, H - 16)
  doc.setLineWidth(0.4)
  doc.rect(12, 12, W - 24, H - 24)

  // En-tête
  doc.setTextColor(DARK_BLUE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.text('EMS', W / 2, 30, { align: 'center' })
  doc.setFontSize(11)
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.text('Évaluation Management Système', W / 2, 37, { align: 'center' })

  // Titre
  doc.setFontSize(26)
  doc.setTextColor(PRIMARY)
  doc.setFont('helvetica', 'bold')
  doc.text('CERTIFICAT DE RÉUSSITE', W / 2, 58, { align: 'center' })

  // Corps
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(INK)
  doc.text('Ce certificat atteste que', W / 2, 74, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(DARK_BLUE)
  doc.text(cert.studentName, W / 2, 86, { align: 'center' })

  const idLine = [
    cert.matricule ? `Matricule : ${cert.matricule}` : null,
    cert.className ? `Classe : ${cert.className}` : null,
  ]
    .filter(Boolean)
    .join('     ')
  if (idLine) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(MUTED)
    doc.text(idLine, W / 2, 94, { align: 'center' })
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(INK)
  doc.text('a réussi avec succès l’évaluation', W / 2, 106, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(INK)
  const title = cert.subjectName
    ? `${cert.evaluationTitle} — ${cert.subjectName}`
    : cert.evaluationTitle
  doc.text(title, W / 2, 116, { align: 'center' })

  // Note & mention
  doc.setFontSize(14)
  doc.setTextColor(PRIMARY)
  doc.text(
    `Note : ${cert.note} / ${cert.totalPoints}     Mention : ${cert.mention}`,
    W / 2,
    128,
    { align: 'center' },
  )

  // Pied : code + date à gauche, QR à droite
  const issued = new Date(cert.issuedAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(MUTED)
  doc.text(`Délivré le ${issued}`, 24, H - 30)
  doc.setTextColor(INK)
  doc.setFont('helvetica', 'bold')
  doc.text(`Code : ${cert.code}`, 24, H - 24)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED)
  doc.setFontSize(8)
  doc.text('Vérifiez l’authenticité en scannant le QR code.', 24, H - 18)

  // QR code (data URL)
  const qrDataUrl = await QRCode.toDataURL(verifyUrl(cert.code), {
    margin: 1,
    width: 256,
  })
  const qrSize = 28
  doc.addImage(qrDataUrl, 'PNG', W - 24 - qrSize, H - 24 - qrSize, qrSize, qrSize)

  doc.save(`certificat-${cert.code}.pdf`)
}
