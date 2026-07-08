// ============================================================
//  Appels API du passage d'évaluation (côté étudiant).
// ============================================================
import { api } from '../../lib/api'

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'TRUE_FALSE'
  | 'MULTIPLE_CHOICE'
  | 'SHORT_ANSWER'

export interface ExamQuestion {
  questionId: string
  type: QuestionType
  statement: string
  points: number
  selectedOptionId: string | null
  selectedOptionIds: string[]
  textAnswer: string | null
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
  type: QuestionType
  statement: string
  points: number
  selectedOptionId: string | null
  correctOptionId: string | null
  selectedOptionIds: string[]
  correctOptionIds: string[]
  textAnswer: string | null
  acceptedAnswers: string[]
  isCorrect: boolean
  options: { id: string; text: string; isCorrect: boolean }[]
}

export interface ResultResponse {
  // hidden=true : l'enseignant a désactivé l'affichage immédiat.
  hidden: boolean
  attempt: {
    id: string
    status: string
    score?: number | null
    submittedAt: string | null
  }
  exam: {
    title: string
    passScore?: number
    durationMinutes?: number
    totalPoints?: number
  }
  passed?: boolean
  correction?: CorrectionItem[]
}

export const startAttempt = (sessionId: string) =>
  api
    .post<StartAttemptResponse>(`/sessions/${sessionId}/start`)
    .then((r) => r.data)

// Sauvegarde d'une réponse : choix unique (selectedOptionId) OU
// choix multiples (selectedOptionIds), selon le type de question.
export const saveAnswer = (
  attemptId: string,
  body:
    | { questionId: string; selectedOptionId: string }
    | { questionId: string; selectedOptionIds: string[] }
    | { questionId: string; text: string },
) => api.patch(`/attempts/${attemptId}/answers`, body).then((r) => r.data)

export const submitAttempt = (attemptId: string) =>
  api.post(`/attempts/${attemptId}/submit`).then((r) => r.data)

export const getResult = (attemptId: string) =>
  api.get<ResultResponse>(`/attempts/${attemptId}/result`).then((r) => r.data)
