// 生产数据 mock 服务（内存数据源）
// 所有生产数据相关接口都从这里取数，保证：
// 1. 指标卡 / 趋势图 / 累计产量 / 列表 / 汇总页看到的是同一份数据
// 2. 含水率只有一个口径：waterCut = water / (oil + water) * 100
// 3. 修正（PUT）按 wellId + reportDate 定位并整体替换，不会重复累加已有产量

import { formatDate, parseDate } from '@/utils/date'

export interface ApiResult<T = any> {
  code: number
  message: string
  data: T
}

export interface Well {
  id: number
  wellCode: string
  wellName: string
  blockName: string
  status: string
}

export interface ProductionRecord {
  id: number
  wellId: number
  wellName: string
  blockName: string
  reportDate: string // YYYY-MM-DD
  productionHours: number
  oilProduction: number
  waterProduction: number
  gasProduction: number
  tubingPressure: number
  casingPressure: number
}

/** 列表/明细使用的行结构：含水率由产量统一计算，避免各处口径不一致 */
export interface ProductionRow extends ProductionRecord {
  waterCut: number
  status: string
}

export interface ProductionQuery {
  wellIds?: number[]
  wellId?: number
  startDate?: string
  endDate?: string
  keyword?: string
  status?: string
  minWaterCut?: number
  sortField?: string
  sortOrder?: 'ascending' | 'descending'
  page?: number
  size?: number
}

export interface TrendPoint {
  date: string
  oilProduction: number
  waterProduction: number
  gasProduction: number
  waterCut: number
}

export const WELLS: Well[] = [
  { id: 1, wellCode: 'A-001', wellName: 'A-01井', blockName: 'A区块', status: '生产中' },
  { id: 2, wellCode: 'B-003', wellName: 'B-03井', blockName: 'B区块', status: '生产中' },
  { id: 3, wellCode: 'C-002', wellName: 'C-02井', blockName: 'C区块', status: '生产中' },
  { id: 4, wellCode: 'D-005', wellName: 'D-05井', blockName: 'D区块', status: '待修井' },
  { id: 5, wellCode: 'E-001', wellName: 'E-01井', blockName: 'E区块', status: '生产中' },
  { id: 6, wellCode: 'F-006', wellName: 'F-06井', blockName: 'B区块', status: '关停井' }
]

// ---- 确定性伪随机（按井播种，保证同一次会话内数据稳定） ----
function createRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

const OIL_BASE: Record<number, number> = { 1: 126, 2: 98, 3: 156, 4: 85, 5: 113, 6: 72 }

function buildSeedRecords(): ProductionRecord[] {
  const records: ProductionRecord[] = []
  let id = 1
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  WELLS.forEach((well) => {
    const rand = createRandom(well.id * 7919 + 13)
    const oilBase = OIL_BASE[well.id] || 100
    for (let i = 95; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const hours = well.status === '关停井' ? 0 : rand() < 0.12 ? 22 : 24
      const oil = hours === 0 ? 0 : +(oilBase + (rand() - 0.5) * 24).toFixed(1)
      const water = hours === 0 ? 0 : +(oil * (2.2 + rand() * 0.9)).toFixed(1)
      const gas = hours === 0 ? 0 : Math.round(oil * (60 + rand() * 20))
      records.push({
        id: id++,
        wellId: well.id,
        wellName: well.wellName,
        blockName: well.blockName,
        reportDate: formatDate(date),
        productionHours: hours,
        oilProduction: oil,
        waterProduction: water,
        gasProduction: gas,
        tubingPressure: +(7.8 + rand() * 1.6).toFixed(1),
        casingPressure: +(11.2 + rand() * 1.8).toFixed(1)
      })
    }
  })
  return records
}

const records: ProductionRecord[] = buildSeedRecords()
let nextId = records.reduce((max, item) => Math.max(max, item.id), 0) + 1

/** 全局接口失败开关，便于联调“接口失败时清理旧内容” */
let mockFail = false
export function setMockFail(value: boolean) {
  mockFail = value
}

const DELAY = 260

function ok<T>(data: T): Promise<ApiResult<T>> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ code: 200, message: 'success', data }), DELAY)
  })
}

function fail(message: string): Promise<ApiResult<never>> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), DELAY)
  })
}

const round1 = (value: number) => Math.round(value * 10) / 10

/** 含水率唯一计算口径 */
export function calcWaterCut(oil: number, water: number): number {
  const total = oil + water
  if (total <= 0) return 0
  return round1((water / total) * 100)
}

function toRow(record: ProductionRecord): ProductionRow {
  const waterCut = calcWaterCut(record.oilProduction, record.waterProduction)
  return {
    ...record,
    waterCut,
    status: record.productionHours === 0 ? '停井' : waterCut >= 85 ? '异常' : '正常'
  }
}

function getWellIds(query: ProductionQuery): number[] {
  if (Array.isArray(query.wellIds) && query.wellIds.length > 0) return query.wellIds
  if (query.wellId !== undefined && query.wellId !== null) return [Number(query.wellId)]
  return WELLS.map((w) => w.id)
}

function filterRecords(query: ProductionQuery): ProductionRecord[] {
  const wellIds = getWellIds(query)
  let result = records.filter((r) => {
    if (!wellIds.includes(r.wellId)) return false
    if (query.startDate && r.reportDate < query.startDate) return false
    if (query.endDate && r.reportDate > query.endDate) return false
    return true
  })

  // 状态、关键字、含水率阈值的过滤与列表基于同一份筛选结果
  if (query.status || query.keyword || query.minWaterCut !== undefined) {
    result = result.filter((r) => {
      const row = toRow(r)
      if (query.status && row.status !== query.status) return false
      if (query.minWaterCut !== undefined && query.minWaterCut !== null && row.waterCut < query.minWaterCut) {
        return false
      }
      if (query.keyword) {
        const keyword = query.keyword.trim()
        if (keyword && !`${r.wellName}${r.reportDate}`.includes(keyword)) return false
      }
      return true
    })
  }
  return result
}

const SORTABLE_FIELDS: Record<string, keyof ProductionRow> = {
  reportDate: 'reportDate',
  oilProduction: 'oilProduction',
  waterProduction: 'waterProduction',
  waterCut: 'waterCut',
  productionHours: 'productionHours'
}

function sortRecords(list: ProductionRecord[], query: ProductionQuery): ProductionRecord[] {
  const field = query.sortField ? SORTABLE_FIELDS[query.sortField] : undefined
  if (!field) {
    return [...list].sort((a, b) => b.reportDate.localeCompare(a.reportDate))
  }
  const factor = query.sortOrder === 'ascending' ? 1 : -1
  return [...list].sort((a, b) => {
    const va = toRow(a)[field] as number | string
    const vb = toRow(b)[field] as number | string
    if (va === vb) return a.reportDate < b.reportDate ? -1 : 1
    return va < vb ? -factor : factor
  })
}

// ---------------- 井位 ----------------

export function fetchProductionWells() {
  if (mockFail) return fail('接口请求失败')
  return ok(WELLS)
}

// ---------------- 列表 / 定位 ----------------

export function fetchProductionList(query: ProductionQuery) {
  if (mockFail) return fail('生产数据列表加载失败')
  const filtered = sortRecords(filterRecords(query), query)
  const page = Math.max(1, query.page || 1)
  const size = query.size || 10
  const start = (page - 1) * size
  const rows = filtered.slice(start, start + size).map(toRow)
  return ok({ rows, total: filtered.length })
}

/** 定位某日数据：返回所在分页，并标记目标行 */
export function locateProductionRecord(query: ProductionQuery & { date: string }) {
  if (mockFail) return fail('生产数据定位失败')
  const filtered = sortRecords(filterRecords(query), query)
  const index = filtered.findIndex(
    (r) => r.reportDate === query.date && getWellIds(query).includes(r.wellId)
  )
  if (index === -1) return ok({ found: false, page: 1, rows: [], total: filtered.length, rowId: null })
  const size = query.size || 10
  const page = Math.floor(index / size) + 1
  const start = (page - 1) * size
  const target = filtered[index]
  return ok({
    found: true,
    page,
    rowId: target.id,
    total: filtered.length,
    rows: filtered.slice(start, start + size).map(toRow)
  })
}

// ---------------- 指标卡（区间内最新一天） ----------------

export function fetchProductionDaily(query: ProductionQuery) {
  if (mockFail) return fail('当日生产指标加载失败')
  const list = sortRecords(filterRecords(query), query)
  if (list.length === 0) return ok(null)
  return ok(toRow(list[0]))
}

// ---------------- 趋势 ----------------

function weekKey(value: string): string {
  const d = parseDate(value)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return formatDate(d)
}

function monthKey(value: string): string {
  return value.slice(0, 7) + '-01'
}

export function fetchProductionTrend(query: ProductionQuery & { granularity?: string }) {
  if (mockFail) return fail('产量趋势加载失败')
  const granularity = query.granularity || 'day'
  const groupKey = granularity === 'week' ? weekKey : granularity === 'month' ? monthKey : (v: string) => v
  const groups = new Map<string, ProductionRecord[]>()
  filterRecords(query).forEach((r) => {
    const key = groupKey(r.reportDate)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  })

  const points: TrendPoint[] = [...groups.keys()]
    .sort()
    .map((key) => {
      const items = groups.get(key)!
      const oil = round1(items.reduce((sum, r) => sum + r.oilProduction, 0))
      const water = round1(items.reduce((sum, r) => sum + r.waterProduction, 0))
      const gas = items.reduce((sum, r) => sum + r.gasProduction, 0)
      return {
        date: key,
        oilProduction: oil,
        waterProduction: water,
        gasProduction: gas,
        waterCut: calcWaterCut(oil, water)
      }
    })
  return ok(points)
}

// ---------------- 累计 / 汇总 ----------------

export interface ProductionSummaryData {
  totalOil: number
  totalWater: number
  totalGas: number
  avgWaterCut: number
  blockProduction: { blockName: string; oilProduction: number }[]
}

export function fetchProductionSummary(query: ProductionQuery) {
  if (mockFail) return fail('生产汇总加载失败')
  const list = filterRecords(query)
  if (list.length === 0) {
    return ok<ProductionSummaryData>({
      totalOil: 0,
      totalWater: 0,
      totalGas: 0,
      avgWaterCut: 0,
      blockProduction: []
    })
  }
  const totalOil = round1(list.reduce((sum, r) => sum + r.oilProduction, 0))
  const totalWater = round1(list.reduce((sum, r) => sum + r.waterProduction, 0))
  const totalGas = list.reduce((sum, r) => sum + r.gasProduction, 0)
  const blockMap = new Map<string, number>()
  list.forEach((r) => {
    blockMap.set(r.blockName, round1((blockMap.get(r.blockName) || 0) + r.oilProduction))
  })
  return ok<ProductionSummaryData>({
    totalOil,
    totalWater,
    totalGas,
    avgWaterCut: calcWaterCut(totalOil, totalWater),
    blockProduction: [...blockMap.entries()]
      .map(([blockName, oilProduction]) => ({ blockName, oilProduction }))
      .sort((a, b) => b.oilProduction - a.oilProduction)
  })
}

// ---------------- 新增 / 修正 / 删除 ----------------

export interface ProductionPayload {
  id?: number
  wellId: number
  reportDate: string
  productionHours: number
  oilProduction: number
  waterProduction: number
  gasProduction: number
  tubingPressure: number
  casingPressure: number
}

function validatePayload(data: ProductionPayload): string | null {
  const well = WELLS.find((w) => w.id === Number(data.wellId))
  if (!well) return '请选择有效的井'
  if (!data.reportDate) return '请选择日期'
  if (!Number.isFinite(Number(data.productionHours)) || Number(data.productionHours) < 0) {
    return '生产时数不合法'
  }
  ;['oilProduction', 'waterProduction', 'gasProduction', 'tubingPressure', 'casingPressure'].forEach(
    (field) => {
      const value = Number((data as any)[field])
      if (!Number.isFinite(value) || value < 0) throw new Error('数值不合法')
    }
  )
  return null
}

/** 新增：同井同日已存在记录时拒绝，防止重复提交把产量再累加一遍 */
export function createProductionRecord(data: ProductionPayload) {
  if (mockFail) return fail('数据提交失败')
  try {
    const message = validatePayload(data)
    if (message) return fail(message)
  } catch (e: any) {
    return fail(e.message)
  }
  const wellId = Number(data.wellId)
  const exists = records.some((r) => r.wellId === wellId && r.reportDate === data.reportDate)
  if (exists) {
    return fail('该井当日生产数据已存在，重复提交不会重复累加，请使用“修正”更新')
  }
  const well = WELLS.find((w) => w.id === wellId)!
  records.push({
    id: nextId++,
    wellId,
    wellName: well.wellName,
    blockName: well.blockName,
    reportDate: data.reportDate,
    productionHours: Number(data.productionHours),
    oilProduction: Number(data.oilProduction),
    waterProduction: Number(data.waterProduction),
    gasProduction: Number(data.gasProduction),
    tubingPressure: Number(data.tubingPressure),
    casingPressure: Number(data.casingPressure)
  })
  return ok({ id: nextId - 1 })
}

/** 修正：按既有 id（或 wellId + reportDate）整体替换，非累加 */
export function updateProductionRecord(data: ProductionPayload) {
  if (mockFail) return fail('数据修正失败')
  try {
    const message = validatePayload(data)
    if (message) return fail(message)
  } catch (e: any) {
    return fail(e.message)
  }
  const index = records.findIndex(
    (r) =>
      r.id === data.id ||
      (r.wellId === Number(data.wellId) && r.reportDate === data.reportDate)
  )
  if (index === -1) return fail('待修正的记录不存在')
  const well = WELLS.find((w) => w.id === Number(data.wellId))!
  records[index] = {
    ...records[index],
    wellId: well.id,
    wellName: well.wellName,
    blockName: well.blockName,
    reportDate: data.reportDate,
    productionHours: Number(data.productionHours),
    oilProduction: Number(data.oilProduction),
    waterProduction: Number(data.waterProduction),
    gasProduction: Number(data.gasProduction),
    tubingPressure: Number(data.tubingPressure),
    casingPressure: Number(data.casingPressure)
  }
  return ok({ id: records[index].id })
}

export function deleteProductionRecord(id: number) {
  if (mockFail) return fail('数据删除失败')
  const index = records.findIndex((r) => r.id === id)
  if (index === -1) return fail('记录不存在')
  records.splice(index, 1)
  return ok({ id })
}
