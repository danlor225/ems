// ============================================================
//  Appels API du module Évaluations (v2).
// ============================================================
import { api } from '../../lib/api'
import type { Paginated } from '../../lib/types'

export type EvaluationStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'OPEN'
  | 'CLOSED'
  | 'ARCHIVED'

export interface EvaluationRow {
  id: string
  code: string | null
  name: string
  status: EvaluationStatus
  effectiveStatus: EvaluationStatus
  subject: string
  academicSession: string | null
  author: string | null
  questionsCount: number
  durationMinutes: number
  passScore: number
  opensAt: string | null
  closesAt: string | null
  createdAt: string
  publishedAt: string | null
}

export interface EvaluationQuery {
  page?: number
  limit?: number
  status?: EvaluationStatus
  subjectId?: string
  search?: string
}

export const getEvaluations = (params: EvaluationQuery = {}) => {
  const q = new URLSearchParams()
  q.set('page', String(params.page ?? 1))
  q.set('limit', String(params.limit ?? 20))
  if (params.status) q.set('status', params.status)
  if (params.subjectId) q.set('subjectId', params.subjectId)
  if (params.search) q.set('search', params.search)
  return api
    .get<Paginated<EvaluationRow>>(`/evaluations?${q.toString()}`)
    .then((r) => r.data)
}

export interface CreateEvaluationBody {
  name: string
  subjectId: string
  academicSessionId: string
  description?: string
  durationMinutes: number
  passScore?: number
  maxScore?: number
  extraTimeMinutes?: number
  attemptsAllowed?: number
  randomizeQuestions?: boolean
  oneQuestionAtATime?: boolean
  shuffleAnswers?: boolean
  showResultImmediately?: boolean
  autoGrade?: boolean
  questionIds?: string[]
}

export const createEvaluation = (body: CreateEvaluationBody) =>
  api
    .post<{ id: string; code: string | null }>('/evaluations', body)
    .then((r) => r.data)

export const publishEvaluation = (
  id: string,
  body: { opensAt: string; closesAt: string },
) => api.post(`/evaluations/${id}/publish`, body)
export const closeEvaluation = (id: string) =>
  api.post(`/evaluations/${id}/close`)
export const archiveEvaluation = (id: string) =>
  api.post(`/evaluations/${id}/archive`)
export const duplicateEvaluation = (id: string) =>
  api.post(`/evaluations/${id}/duplicate`)
export const deleteEvaluation = (id: string) =>
  api.delete(`/evaluations/${id}`)
