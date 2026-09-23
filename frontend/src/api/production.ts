import request from '@/utils/request'
import { ProductionMetric, ProductionRecord, ProductionSummary, TrendPoint } from '@/utils/production'

export interface ProductionListParams {
  wellId?: number
  wellIds?: number[]
  startDate?: string
  endDate?: string
  status?: string
  mockError?: boolean
}

export interface ProductionListResult {
  list: ProductionRecord[]
  total: number
}

/** 生产明细列表：井 + 日期 + 状态，服务端按天口径过滤 */
export function getProductionList(params: ProductionListParams) {
  return request({
    url: '/production/list',
    method: 'get',
    params: {
      ...params,
      wellIds: params.wellIds?.length ? params.wellIds.join(',') : undefined
    }
  }).then(res => res.data as ProductionListResult)
}

/** 指标卡：查询窗口内最新一天的明细 */
export function getProductionDaily(wellId: number, params: ProductionListParams) {
  return request({
    url: `/production/${wellId}/daily`,
    method: 'get',
    params
  }).then(res => res.data as ProductionRecord | null)
}

/** 产量趋势：按天（或周/月）聚合 */
export function getProductionTrend(
  wellId: number,
  params: ProductionListParams & { period?: 'daily' | 'weekly' | 'monthly'; metric?: ProductionMetric }
) {
  return request({
    url: `/production/${wellId}/trend`,
    method: 'get',
    params
  }).then(res => res.data as TrendPoint[])
}

/** 多井趋势（报表汇总页用），与列表/汇总同一时间口径 */
export function getProductionTrendMulti(
  params: ProductionListParams & { period?: 'daily' | 'weekly' | 'monthly' }
) {
  return request({
    url: '/production/trend',
    method: 'get',
    params: {
      ...params,
      wellIds: params.wellIds?.length ? params.wellIds.join(',') : undefined
    }
  }).then(res => res.data as TrendPoint[])
}

/** 累计产量/综合含水率，与列表同一时间口径 */
export function getProductionSummary(params: ProductionListParams) {
  return request({
    url: '/production/summary',
    method: 'get',
    params: {
      ...params,
      wellIds: params.wellIds?.length ? params.wellIds.join(',') : undefined
    }
  }).then(res => res.data as ProductionSummary)
}

export interface ProductionFormData {
  id?: number
  wellId: number
  reportDate: string
  productionHours: number
  oilProduction: number
  waterProduction: number
  gasProduction: number
  tubingPressure: number
  casingPressure: number
  status: string
  mockError?: boolean
}

/**
 * 提交/修正生产数据。
 * 后端按“井 + 日期”幂等 upsert：重复提交不会再次累加已有产量。
 */
export function submitProductionData(data: ProductionFormData) {
  return request({
    url: '/production',
    method: 'post',
    data
  }).then(res => res.data as ProductionRecord)
}

/** 明细详情 */
export function getProductionDetail(wellId: number, reportDate: string) {
  return request({
    url: `/production/${wellId}`,
    method: 'get',
    params: { reportDate }
  }).then(res => res.data as ProductionRecord | null)
}
