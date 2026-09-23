/**
 * 生产数据领域模型与公共口径工具
 * 列表页、汇总（报表）页、趋势图、指标卡共用同一套筛选与汇总规则，
 * 避免“同一时间段多处数值对不上”的问题。
 */

export interface WellInfo {
  id: number
  wellName: string
  wellCode: string
}

export interface ProductionRecord {
  id: number
  wellId: number
  wellName: string
  /** 数据归属日期，格式 YYYY-MM-DD（按天口径，不含时分秒） */
  reportDate: string
  productionHours: number
  oilProduction: number
  waterProduction: number
  gasProduction: number
  tubingPressure: number
  casingPressure: number
  /** 数据状态：正常 / 异常 */
  status: string
  /** 最近一次修正时间 */
  updateTime: string
  /** 含水率，单位 %，由油/水产量统一推导 */
  waterCut: number
}

export type ProductionMetric = 'oil' | 'water' | 'waterCut'

/** 统一的查询条件：井 + 按天起止日期（闭区间） */
export interface ProductionQuery {
  wellId?: number
  wellIds?: number[]
  startDate?: string
  endDate?: string
  status?: string
  /** 模拟接口失败的测试开关，仅 mock 使用 */
  mockError?: boolean
}

export const METRIC_LABELS: Record<ProductionMetric, string> = {
  oil: '产油量',
  water: '产水量',
  waterCut: '含水率'
}

export const METRIC_UNITS: Record<ProductionMetric, string> = {
  oil: 't',
  water: 't',
  waterCut: '%'
}

/** 日期格式化为 YYYY-MM-DD（本地时区，按天口径） */
export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, delta: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + delta)
  return r
}

/** 默认时间窗口：最近 30 天（含今天），所有页面一致 */
export function defaultDateRange(): [string, string] {
  const today = new Date()
  return [formatDate(addDays(today, -29)), formatDate(today)]
}

/**
 * 统一时间口径：判断数据日期是否落在查询窗口内（含首尾，按天比较）。
 * 任何列表/趋势/汇总查询都必须经过本函数过滤。
 */
export function inTimeRange(reportDate: string, q: ProductionQuery): boolean {
  if (q.startDate && reportDate < q.startDate) return false
  if (q.endDate && reportDate > q.endDate) return false
  return true
}

/** 统一过滤条件（井 + 日期 + 状态），三处面板共用 */
export function filterRecords(records: ProductionRecord[], q: ProductionQuery): ProductionRecord[] {
  return records.filter(r => {
    if (q.wellId !== undefined && r.wellId !== q.wellId) return false
    if (q.wellIds && q.wellIds.length > 0 && !q.wellIds.includes(r.wellId)) return false
    if (q.status && r.status !== q.status) return false
    return inTimeRange(r.reportDate, q)
  })
}

/**
 * 统一含水率口径：含水率 = 水 / (油 + 水) × 100%
 * 指标卡、明细、累计面板均从同一公式取值，不再使用各自独立字段。
 */
export function calcWaterCut(oil: number, water: number): number {
  const total = oil + water
  if (total <= 0) return 0
  return Number(((water / total) * 100).toFixed(2))
}

export interface ProductionSummary {
  totalOil: number
  totalWater: number
  totalGas: number
  /** 按液量加权的综合含水率 */
  waterCut: number
  totalHours: number
  recordCount: number
}

/**
 * 统一汇总口径：基于“筛选后的同一批明细记录”聚合。
 * 累计产量与明细列表永远同源，明细修正后重算即得到新汇总。
 */
export function summarize(records: ProductionRecord[]): ProductionSummary {
  const totalOil = round2(records.reduce((s, r) => s + r.oilProduction, 0))
  const totalWater = round2(records.reduce((s, r) => s + r.waterProduction, 0))
  const totalGas = records.reduce((s, r) => s + r.gasProduction, 0)
  const totalHours = records.reduce((s, r) => s + r.productionHours, 0)
  return {
    totalOil,
    totalWater,
    totalGas,
    waterCut: calcWaterCut(totalOil, totalWater),
    totalHours,
    recordCount: records.length
  }
}

/** 按天聚合（同井同天只可能有一条记录；多井时按天求和） */
export interface TrendPoint {
  reportDate: string
  oilProduction: number
  waterProduction: number
  gasProduction: number
  waterCut: number
}

/** 统一趋势口径：基于筛选后的明细按日期聚合，日期升序 */
export function buildTrend(records: ProductionRecord[]): TrendPoint[] {
  const map = new Map<string, ProductionRecord[]>()
  for (const r of records) {
    const arr = map.get(r.reportDate)
    if (arr) arr.push(r)
    else map.set(r.reportDate, [r])
  }
  return [...map.keys()]
    .sort()
    .map(date => {
      const dayRecords = map.get(date)!
      const oil = round2(dayRecords.reduce((s, r) => s + r.oilProduction, 0))
      const water = round2(dayRecords.reduce((s, r) => s + r.waterProduction, 0))
      return {
        reportDate: date,
        oilProduction: oil,
        waterProduction: water,
        gasProduction: dayRecords.reduce((s, r) => s + r.gasProduction, 0),
        waterCut: calcWaterCut(oil, water)
      }
    })
}

/** 周/月趋势口径（报表页用）：在日趋势基础上按周期聚合 */
export function groupTrend(
  points: TrendPoint[],
  period: 'daily' | 'weekly' | 'monthly'
): TrendPoint[] {
  if (period === 'daily') return points
  const keyOf = (date: string): string => {
    if (period === 'monthly') return date.slice(0, 7)
    return isoWeekKey(date)
  }
  const map = new Map<string, TrendPoint[]>()
  for (const p of points) {
    const k = keyOf(p.reportDate)
    const arr = map.get(k)
    if (arr) arr.push(p)
    else map.set(k, [p])
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, arr]) => {
      const oil = round2(arr.reduce((s, p) => s + p.oilProduction, 0))
      const water = round2(arr.reduce((s, p) => s + p.waterProduction, 0))
      return {
        reportDate: key,
        oilProduction: oil,
        waterProduction: water,
        gasProduction: arr.reduce((s, p) => s + p.gasProduction, 0),
        waterCut: calcWaterCut(oil, water)
      }
    })
}

/** ISO 周标识，例如 2024-W03（取周一作为分组依据） */
function isoWeekKey(date: string): string {
  const d = new Date(date + 'T00:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  // 以周一日期作为周键，保证可排序且口径稳定
  return formatDate(d)
}

/** 取查询窗口内最新一天的明细（指标卡用），无数据返回 null */
export function latestRecord(records: ProductionRecord[]): ProductionRecord | null {
  if (records.length === 0) return null
  return [...records].sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1))[0]
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
