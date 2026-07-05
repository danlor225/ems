// ============================================================
//  Appels API des résultats (staff).
// ============================================================
import { api } from '../../lib/api'
import type { Paginated } from '../../lib/types'

export interface ResultRow {
  attemptId: string
  student: { id: string; firstName: string; lastName: string; email: string }
  examTitle: string
  score: number | null
  passed: boolean
  status: string
  submittedAt: string | null
}

export interface StaffResult {
  attempt: {
    id: string
    status: string
    score: number | null
    submittedAt: string | null
  }
  student: { id: string; firstName: string; lastName: string; email: string }
  exam: { title: string; passScore: number; durationMinutes: number }
  passed: boolean
  correction: {
    questionId: string
    statement: string
    points: number
    selectedOptionId: string | null
    correctOptionId: string | null
    isCorrect: boolean
    options: { id: string; text: string; isCorrect: boolean }[]
  }[]
}

export const getResults = (
  params: { examId?: string; status?: string; page?: number; limit?: number } = {},
) => {
  const q = new URLSearchParams()
  q.set('page', String(params.page ?? 1))
  q.set('limit', String(params.limit ?? 50))
  if (params.examId) q.set('examId', params.examId)
  if (params.status) q.set('status', params.status)
  return api.get<Paginated<ResultRow>>(`/results?${q.toString()}`).then((r) => r.data)
}

export const getResultDetail = (attemptId: string) =>
  api.get<StaffResult>(`/results/${attemptId}`).then((r) => r.data)

// ---- Résultats par évaluation (Phase C) ----
export type ResultStatus = 'Très Bien' | 'Bien' | 'Passable' | 'Mauvais'

export interface EvaluationResultStudent {
  attemptId: string
  firstName: string
  lastName: string
  email: string
  submittedAt: string | null
  timeSpentSeconds: number | null
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  note: number
  status: ResultStatus
  observation: string
}

export interface EvaluationResults {
  evaluation: {
    id: string
    title: string
    passScore: number
    totalPoints: number
  }
  stats: {
    participants: number
    average: number
    max: number
    min: number
    median: number
    stdDev: number
    successRate: number
    distribution: {
      tresBien: number
      bien: number
      passable: number
      mauvais: number
    }
  }
  students: EvaluationResultStudent[]
}

export const getEvaluationResults = (evaluationId: string) =>
  api
    .get<EvaluationResults>(`/results/evaluation/${evaluationId}`)
    .then((r) => r.data)

