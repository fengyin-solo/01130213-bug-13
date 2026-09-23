import {
  fetchProductionWells,
  fetchProductionDaily,
  fetchProductionTrend,
  fetchProductionSummary,
  fetchProductionList,
  locateProductionRecord,
  createProductionRecord,
  updateProductionRecord,
  deleteProductionRecord
} from '@/mock/productionDb'
import type { ProductionPayload, ProductionQuery } from '@/mock/productionDb'

/** 生产运营页使用的井位列表（取自同一内存数据源） */
export function getProductionWells() {
  return fetchProductionWells()
}

export function getProductionList(params: ProductionQuery) {
  return fetchProductionList(params)
}

export function locateProduction(params: ProductionQuery & { date: string }) {
  return locateProductionRecord(params)
}

export function getProductionDaily(params: ProductionQuery) {
  return fetchProductionDaily(params)
}

export function getProductionTrend(params: ProductionQuery & { granularity?: string }) {
  return fetchProductionTrend(params)
}

export function getProductionSummary(params: ProductionQuery) {
  return fetchProductionSummary(params)
}

/** 新增生产数据：同井同日重复提交会被服务端拒绝 */
export function submitProductionData(data: ProductionPayload) {
  return createProductionRecord(data)
}

/** 修正生产数据：整体替换已有记录，不累加 */
export function correctProductionData(data: ProductionPayload) {
  return updateProductionRecord(data)
}

export function removeProductionData(id: number) {
  return deleteProductionRecord(id)
}
