// ============================================================
//  Appels API des questions.
// ============================================================
import { api } from '../../lib/api'
import type { Paginated } from '../../lib/types'

export interface AnswerOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface Question {
  id: string
  subjectId: string
  statement: string
  points: number
  isActive: boolean
  createdAt: string
  options: AnswerOption[]
}

export interface CreateQuestionBody {
  subjectId: string
  statement: string
  points?: number
  options: { text: string; isCorrect: boolean }[]
}

export const getQuestions = (subjectId?: string, page = 1, limit = 50) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (subjectId) params.set('subjectId', subjectId)
  return api
    .get<Paginated<Question>>(`/questions?${params.toString()}`)
    .then((r) => r.data)
}

export const createQuestion = (body: CreateQuestionBody) =>
  api.post<Question>('/questions', body).then((r) => r.data)

export const deleteQuestion = (id: string) => api.delete(`/questions/${id}`)
