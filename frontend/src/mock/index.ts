import axios, { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { getRecordStore, mockWells, upsertRecord } from './db'
import {
  ProductionRecord,
  buildTrend,
  filterRecords,
  groupTrend,
  latestRecord,
  summarize
} from '@/utils/production'

/**
 * 模拟后端：所有接口与真实后端同形（{code,message,data}），
 * 页面只通过 src/api 调用，将来切真实后端时无需改页面。
 */

interface ApiResult {
  code: number
  message: string
  data?: any
}

const ok = (data: any): ApiResult => ({ code: 200, message: 'success', data })
const fail = (message: string, code = 500): ApiResult => ({ code, message })

function parseParams(config: InternalAxiosRequestConfig): Record<string, any> {
  return (config.params as Record<string, any>) || {}
}

function parseBody(config: InternalAxiosRequestConfig): Record<string, any> {
  const data = config.data
  if (!data) return {}
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return {}
    }
  }
  return data as Record<string, any>
}

/** 与页面完全一致的查询口径（井/多井 + 日期 + 状态） */
function buildQuery(params: Record<string, any>) {
  const wellIds = params.wellIds
    ? String(params.wellIds)
        .split(',')
        .map(Number)
        .filter(n => !Number.isNaN(n))
    : undefined
  return {
    wellId: params.wellId !== undefined && params.wellId !== '' ? Number(params.wellId) : undefined,
    wellIds,
    startDate: params.startDate,
    endDate: params.endDate,
    status: params.status || undefined
  }
}

const routes: { method: string; test: (url: string) => RegExpExecArray | null }[] = [
  { method: 'get', test: url => /^\/well\/list$/.exec(url) },
  { method: 'get', test: url => /^\/production\/summary$/.exec(url) },
  { method: 'get', test: url => /^\/production\/trend$/.exec(url) },
  { method: 'get', test: url => /^\/production\/list$/.exec(url) },
  { method: 'get', test: url => /^\/production\/(\d+)\/daily$/.exec(url) },
  { method: 'get', test: url => /^\/production\/(\d+)\/trend$/.exec(url) },
  { method: 'get', test: url => /^\/production\/(\d+)$/.exec(url) },
  { method: 'post', test: url => /^\/production$/.exec(url) }
]

function handle(url: string, method: string, config: InternalAxiosRequestConfig): ApiResult {
  const params = parseParams(config)
  // 接口失败演示开关：任意接口携带 mockError=true 时直接报错
  if (params.mockError === 'true' || params.mockError === true) {
    return fail('接口请求失败（模拟）')
  }

  for (const route of routes) {
    if (route.method !== method) continue
    const m = route.test(url)
    if (!m) continue

    // 井位列表
    if (/^\/well\/list$/.test(url)) {
      return ok(mockWells)
    }

    // 生产明细列表（井 + 日期 + 状态，服务端按天口径过滤）
    if (/^\/production\/list$/.test(url)) {
      const records = filterRecords(getRecordStore(), buildQuery(params))
      return ok({
        list: records.map(clone),
        total: records.length
      })
    }

    // 汇总：累计产量/综合含水率，与列表同口径
    if (/^\/production\/summary$/.test(url)) {
      const records = filterRecords(getRecordStore(), buildQuery(params))
      return ok(summarize(records))
    }

    // 多井趋势（报表页用）：同一时间口径
    if (/^\/production\/trend$/.test(url)) {
      const records = filterRecords(getRecordStore(), buildQuery(params))
      const period = params.period === 'weekly' || params.period === 'monthly' ? params.period : 'daily'
      return ok(groupTrend(buildTrend(records), period))
    }

    if (/^\/production\/(\d+)\/daily$/.test(url)) {
      const wellId = Number(m[1])
      const records = filterRecords(getRecordStore(), { ...buildQuery(params), wellId })
      return ok(latestRecord(records) ? clone(latestRecord(records)!) : null)
    }

    if (/^\/production\/(\d+)\/trend$/.test(url)) {
      const wellId = Number(m[1])
      const records = filterRecords(getRecordStore(), { ...buildQuery(params), wellId })
      const period = params.period === 'weekly' || params.period === 'monthly' ? params.period : 'daily'
      return ok(groupTrend(buildTrend(records), period))
    }

    if (/^\/production\/(\d+)$/.test(url) && method === 'get') {
      const wellId = Number(m[1])
      // 按业务主键（井 + 数据日期）查询，不能与记录自增 id 混淆
      const record = getRecordStore().find(
        r => r.wellId === wellId && r.reportDate === params.reportDate
      )
      return ok(record ? clone(record) : null)
    }

    // 提交/修正：按 井+日期 幂等 upsert
    if (/^\/production$/.test(url) && method === 'post') {
      const body = parseBody(config)
      if (body.mockError === true) return fail('接口请求失败（模拟）')
      if (!body.wellId || !body.reportDate) {
        return fail('井与日期不能为空', 400)
      }
      const saved = upsertRecord({
        id: body.id,
        wellId: Number(body.wellId),
        reportDate: body.reportDate,
        productionHours: Number(body.productionHours ?? 0),
        oilProduction: Number(body.oilProduction ?? 0),
        waterProduction: Number(body.waterProduction ?? 0),
        gasProduction: Number(body.gasProduction ?? 0),
        tubingPressure: Number(body.tubingPressure ?? 0),
        casingPressure: Number(body.casingPressure ?? 0),
        status: body.status || '正常'
      })
      return ok(clone(saved))
    }
  }

  return { code: 404, message: `Mock 接口不存在: ${method.toUpperCase()} ${url}` }
}

function clone(r: ProductionRecord): ProductionRecord {
  return { ...r }
}

export const mockAdapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
  // 去掉 /api 前缀，匹配真实后端路径
  const url = (config.url || '').replace(/^\/api/, '')
  const method = (config.method || 'get').toLowerCase()

  // 未被 mock 覆盖的接口放行给真实后端（xhr），保持其他页面行为不变
  const matched = routes.some(r => r.method === method && r.test(url))
  if (!matched) {
    return axios.getAdapter('xhr')(config)
  }

  const latency = 200 + Math.round(Math.random() * 250)

  return new Promise<AxiosResponse>((resolve, reject) => {
    setTimeout(() => {
      const result = handle(url, method, config)
      const response: AxiosResponse = {
        data: result,
        status: result.code === 404 ? 404 : 200,
        statusText: result.code === 200 ? 'OK' : 'ERROR',
        headers: {},
        config,
        request: {}
      }
      if (result.code === 200) {
        resolve(response)
      } else {
        // 业务/网络错误，交由 request.ts 的响应拦截器统一提示
        reject(Object.assign(new Error(result.message), { response, isMockError: true }))
      }
    }, latency)
  })
}
