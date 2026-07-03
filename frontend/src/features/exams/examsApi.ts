// ============================================================
//  Appels API des examens.
// ============================================================
import { api } from '../../lib/api'
import type { Paginated } from '../../lib/types'

export interface Exam {
  id: string
  subjectId: string
  title: string
  durationMinutes: number
  passScore: number
  isPublished: boolean
  createdAt: string
  _count?: { examQuestions: number }
}

export interface CreateExamBody {
  title: string
  subjectId: string
  durationMinutes: number
  passScore?: number
  questionIds: string[]
}

export const getExams = (page = 1, limit = 50) =>
  api.get<Paginated<Exam>>(`/exams?page=${page}&limit=${limit}`).then((r) => r.data)

export const createExam = (body: CreateExamBody) =>
  api.post<Exam>('/exams', body).then((r) => r.data)

export const publishExam = (id: string) => api.post(`/exams/${id}/publish`)
export const unpublishExam = (id: string) => api.post(`/exams/${id}/unpublish`)
export const deleteExam = (id: string) => api.delete(`/exams/${id}`)
