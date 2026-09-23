import { normalizeDateRange } from '@/utils/date'
import type { ProductionQuery } from '@/mock/productionDb'

export interface ProductionFilters {
  wellIds?: number[]
  wellId?: number
  dateRange?: unknown
}

/**
 * 生产运营页与报表分析页共用的查询参数构造：
 * 时间范围统一走 normalizeDateRange（本地自然日、闭区间），保证两页同一时间口径。
 */
export function buildProductionQuery(filters: ProductionFilters): ProductionQuery {
  const query: ProductionQuery = {
    ...normalizeDateRange(filters.dateRange)
  }
  if (filters.wellId !== undefined && filters.wellId !== null) {
    query.wellId = Number(filters.wellId)
  }
  if (filters.wellIds && filters.wellIds.length > 0) {
    query.wellIds = filters.wellIds.map(Number)
  }
  return query
}
