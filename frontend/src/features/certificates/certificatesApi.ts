// ============================================================
//  Appels API des certificats.
//  Staff : liste / émission / révocation.
//  Public : vérification par code (aucune auth requise).
// ============================================================
import { api } from '../../lib/api'
import type { Paginated } from '../../lib/types'

export interface CertificateRow {
  id: string
  code: string
  studentName: string
  studentEmail: string
  matricule: string | null
  className: string | null
  evaluationTitle: string
  subjectName: string | null
  note: number
  totalPoints: number
  mention: string
  issuedAt: string
  revokedAt: string | null
}

// Snapshot public (sans email ni id technique).
export interface PublicCertificate {
  code: string
  studentName: string
  matricule: string | null
  className: string | null
  evaluationTitle: string
  subjectName: string | null
  note: number
  totalPoints: number
  mention: string
  issuedAt: string
}

export type VerifyResponse =
  | { found: false }
  | {
      found: true
      valid: boolean
      revokedAt: string | null
      certificate: PublicCertificate
    }

export interface CertificateQuery {
  page?: number
  limit?: number
  search?: string
  evaluationId?: string
  status?: 'valid' | 'revoked'
}

export const getCertificates = (params: CertificateQuery = {}) => {
  const q = new URLSearchParams()
  q.set('page', String(params.page ?? 1))
  q.set('limit', String(params.limit ?? 50))
  if (params.search) q.set('search', params.search)
  if (params.evaluationId) q.set('evaluationId', params.evaluationId)
  if (params.status) q.set('status', params.status)
  return api
    .get<Paginated<CertificateRow>>(`/certificates?${q.toString()}`)
    .then((r) => r.data)
}

export const issueCertificate = (attemptId: string) =>
  api.post<CertificateRow>('/certificates', { attemptId }).then((r) => r.data)

export interface BulkIssueResult {
  issued: number
  skipped: number
  candidates: number
}

export const issueCertificatesForEvaluation = (evaluationId: string) =>
  api
    .post<BulkIssueResult>(`/certificates/evaluation/${evaluationId}`)
    .then((r) => r.data)

export const revokeCertificate = (id: string) =>
  api.post<CertificateRow>(`/certificates/${id}/revoke`).then((r) => r.data)

export const verifyCertificate = (code: string) =>
  api
    .get<VerifyResponse>(`/certificates/verify/${encodeURIComponent(code)}`)
    .then((r) => r.data)
