// ============================================================
//  Types partagés côté frontend.
// ============================================================
export interface Paginated<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
