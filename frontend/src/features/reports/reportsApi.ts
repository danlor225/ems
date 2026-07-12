// ============================================================
//  Appels API des rapports analytiques (staff).
// ============================================================
import { api } from '../../lib/api'

export interface Aggregate {
  label: string
  participants: number
  average: number // moyenne sur 20
  successRate: number // % de réussite
}

export interface ReportsData {
  overview: Aggregate
  bySubject: Aggregate[]
  byGroup: Aggregate[]
  timeline: Aggregate[]
}

export const getReports = () =>
  api.get<ReportsData>('/reports').then((r) => r.data)
