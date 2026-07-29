// ============================================================
//  Appels API du module Cours (supports pédagogiques).
// ============================================================
import { api } from '../../lib/api'
import type { Paginated } from '../../lib/types'

export type CourseResourceType = 'DOCUMENT' | 'VIDEO'

export interface CourseResource {
  id: string
  type: CourseResourceType
  title: string
  url: string
  order: number
}

// Élément de liste : le back renvoie la matière, l'auteur et le nombre
// de ressources (via Prisma _count).
export interface CourseListItem {
  id: string
  title: string
  description: string | null
  isPublished: boolean
  isPaid: boolean
  price: number // FCFA
  subjectId: string
  groupId: string | null // null = visible par tous
  authorId: string | null
  createdAt: string
  updatedAt: string
  subject: { id: string; name: string } | null
  group: { id: string; name: string } | null
  author: { id: string; firstName: string; lastName: string } | null
  _count: { resources: number }
}

// Détail : idem + ressources ordonnées + état d'accès (cours payant) et
// présence de l'étudiant courant.
export interface CourseDetail extends Omit<CourseListItem, '_count'> {
  resources: CourseResource[]
  hasAccess: boolean
  locked: boolean
  myAttendanceAt: string | null
}

// Ce que l'on envoie pour une ressource (l'id/order sont gérés côté back).
export interface CourseResourceInput {
  type: CourseResourceType
  title: string
  url: string
}

export interface CourseInput {
  subjectId: string
  title: string
  description?: string
  isPublished?: boolean
  isPaid?: boolean
  price?: number
  groupId?: string | null // null = cours public
  resources?: CourseResourceInput[]
}

export const getCourses = (params?: { subjectId?: string }) => {
  const qs = new URLSearchParams({ limit: '100' })
  if (params?.subjectId) qs.set('subjectId', params.subjectId)
  return api
    .get<Paginated<CourseListItem>>(`/courses?${qs.toString()}`)
    .then((r) => r.data)
}

export const getCourse = (id: string) =>
  api.get<CourseDetail>(`/courses/${id}`).then((r) => r.data)

export const createCourse = (body: CourseInput) =>
  api.post<CourseDetail>('/courses', body).then((r) => r.data)

export const updateCourse = (id: string, body: Partial<CourseInput>) =>
  api.patch<CourseDetail>(`/courses/${id}`, body).then((r) => r.data)

export const deleteCourse = (id: string) => api.delete(`/courses/${id}`)

// Téléverse un fichier et renvoie l'URL publique (à mettre dans `url`).
export interface UploadedFile {
  url: string
  title: string
}
export const uploadCourseFile = (file: File, type: CourseResourceType) => {
  const form = new FormData()
  form.append('file', file)
  // multipart : axios positionne automatiquement le bon Content-Type.
  return api
    .post<UploadedFile>(`/courses/upload?type=${type}`, form)
    .then((r) => r.data)
}

// Origine de l'API (sans le suffixe /api), pour absolutiser les fichiers
// servis (ex: "/api/files/x.pdf" -> "http://localhost:3000/api/files/x.pdf").
const API_ORIGIN = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
).replace(/\/api\/?$/, '')

// Un lien externe (http…) est renvoyé tel quel ; un chemin de fichier
// téléversé (commençant par /) est préfixé par l'origine de l'API.
export const resolveFileUrl = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`

// ---------- Présence (auto-déclarée) ----------

export interface AttendanceRow {
  id: string
  firstName: string
  lastName: string
  email: string
  markedAt: string
}

// L'étudiant se déclare présent ; renvoie l'horodatage retenu.
export const markAttendance = (courseId: string) =>
  api
    .post<{ markedAt: string }>(`/courses/${courseId}/attendance`, {})
    .then((r) => r.data)

// Le staff récupère la feuille de présence.
export const getAttendance = (courseId: string) =>
  api
    .get<AttendanceRow[]>(`/courses/${courseId}/attendance`)
    .then((r) => r.data)

// ---------- Accès (cours payants) ----------

export interface AccessRow {
  id: string
  firstName: string
  lastName: string
  email: string
  source: 'MANUAL' | 'PAYMENT'
  grantedAt: string
}

export const getAccess = (courseId: string) =>
  api.get<AccessRow[]>(`/courses/${courseId}/access`).then((r) => r.data)

// Accorde l'accès par email (le staff ne connaît pas l'UUID étudiant).
export const grantAccess = (courseId: string, email: string) =>
  api.post(`/courses/${courseId}/access`, { email }).then((r) => r.data)

export const revokeAccess = (courseId: string, studentId: string) =>
  api.delete(`/courses/${courseId}/access/${studentId}`)

// ---------- Format monétaire (FCFA, entier) ----------

export const formatFcfa = (price: number) =>
  `${new Intl.NumberFormat('fr-FR').format(price)} FCFA`
