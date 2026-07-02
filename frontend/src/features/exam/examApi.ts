// ============================================================
//  Appels API du passage d'évaluation (côté étudiant).
// ============================================================
import { api } from '../../lib/api'

export interface ExamQuestion {
  questionId: string
  statement: string
  points: number
  selectedOptionId: string | null
  options: { id: string; text: string }[]
}

export interface StartAttemptResponse {
  attempt: {
    id: string
    status: string
    startedAt: string
    expiresAt: string
    remainingSeconds: number
  }
  exam: { id: string; title: string; durationMinutes: number }
  questions: ExamQuestion[]
}

export interface CorrectionItem {
  questionId: string
  statement: string
  points: number
  selectedOptionId: string | null
  correctOptionId: string | null
  isCorrect: boolean
  options: { id: string; text: string; isCorrect: boolean }[]
}

export interface ResultResponse {
  attempt: {
    id: string
    status: string
    score: number | null
    submittedAt: string | null
  }
  exam: { title: string; passScore: number; durationMinutes: number }
  passed: boolean
  correction: CorrectionItem[]
}

export const startAttempt = (sessionId: string) =>
  api
    .post<StartAttemptResponse>(`/sessions/${sessionId}/start`)
    .then((r) => r.data)

export const saveAnswer = (
  attemptId: string,
  questionId: string,
  selectedOptionId: string,
) =>
  api
    .patch(`/attempts/${attemptId}/answers`, { questionId, selectedOptionId })
    .then((r) => r.data)

export const submitAttempt = (attemptId: string) =>
  api.post(`/attempts/${attemptId}/submit`).then((r) => r.data)

export const getResult = (attemptId: string) =>
  api.get<ResultResponse>(`/attempts/${attemptId}/result`).then((r) => r.data)
