import {
  ProductionRecord,
  WellInfo,
  calcWaterCut,
  formatDate,
  addDays
} from '@/utils/production'

/**
 * 浏览器内模拟数据库（前端原型无真实后端）。
 * 模块级单例，修正数据时直接覆盖库内记录，重新查询/汇总即为新值。
 */

export const mockWells: WellInfo[] = [
  { id: 1, wellName: 'A-01井', wellCode: 'A-001' },
  { id: 2, wellName: 'B-03井', wellCode: 'B-003' },
  { id: 3, wellName: 'C-02井', wellCode: 'C-002' },
  { id: 4, wellName: 'D-05井', wellCode: 'D-005' }
]

interface Seed {
  oil: number
  waterRate: number
  gas: number
  hours: number
  pressure: number
}

const wellSeeds: Record<number, Seed> = {
  1: { oil: 126, waterRate: 2.8, gas: 8500, hours: 24, pressure: 8.5 },
  2: { oil: 98, waterRate: 2.9, gas: 7200, hours: 24, pressure: 7.8 },
  3: { oil: 156, waterRate: 2.6, gas: 9800, hours: 22, pressure: 9.2 },
  4: { oil: 85, waterRate: 3.1, gas: 6500, hours: 24, pressure: 6.9 }
}

/** 伪随机：同一井同一天永远得到同一值，保证数据稳定可复现 */
function seeded(wellId: number, dayIndex: number, salt: number): number {
  const x = Math.sin(wellId * 97 + dayIndex * 13 + salt * 31) * 10000
  return x - Math.floor(x)
}

function buildRecords(): ProductionRecord[] {
  const records: ProductionRecord[] = []
  // 以“今天”为基准生成最近 60 天数据，演示默认最近 30 天窗口
  const today = new Date()
  let id = 1
  mockWells.forEach(well => {
    const seed = wellSeeds[well.id]
    for (let i = 59; i >= 0; i--) {
      const dayIndex = 59 - i
      const date = formatDate(addDays(today, -i))
      const wave = (seeded(well.id, dayIndex, 1) - 0.5) * 0.12
      const oil = Number((seed.oil * (1 + wave)).toFixed(1))
      const water = Number((oil * seed.waterRate * (1 + (seeded(well.id, dayIndex, 2) - 0.5) * 0.08)).toFixed(1))
      const gas = Math.round(seed.gas * (1 + (seeded(well.id, dayIndex, 3) - 0.5) * 0.1))
      // 个别日期生产时数不足或状态异常
      const down = seeded(well.id, dayIndex, 4) > 0.93
      const hours = down ? Number((seed.hours - 6 - seeded(well.id, dayIndex, 5) * 8).toFixed(1)) : seed.hours
      const status = down || seeded(well.id, dayIndex, 6) > 0.9 ? '异常' : '正常'
      const pressure = Number((seed.pressure + (seeded(well.id, dayIndex, 7) - 0.5) * 0.6).toFixed(1))
      records.push({
        id: id++,
        wellId: well.id,
        wellName: well.wellName,
        reportDate: date,
        productionHours: Math.max(0, hours),
        oilProduction: oil,
        waterProduction: water,
        gasProduction: gas,
        tubingPressure: pressure,
        casingPressure: Number((pressure + 3.5 + (seeded(well.id, dayIndex, 8) - 0.5) * 0.4).toFixed(1)),
        status,
        updateTime: `${date} 08:00:00`,
        waterCut: calcWaterCut(oil, water)
      })
    }
  })
  return records
}

const store: ProductionRecord[] = buildRecords()
let nextId = store.length + 1

export function getRecordStore(): ProductionRecord[] {
  return store
}

export function findRecord(wellId: number, reportDate: string): ProductionRecord | undefined {
  return store.find(r => r.wellId === wellId && r.reportDate === reportDate)
}

/**
 * 按业务主键（井 + 日期）幂等写入：
 * 已存在则整体覆盖，不存在才新增。重复提交修正不会再次累加产量。
 */
export function upsertRecord(
  data: Omit<ProductionRecord, 'id' | 'wellName' | 'waterCut' | 'updateTime'> & { id?: number }
): ProductionRecord {
  const well = mockWells.find(w => w.id === data.wellId)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const updateTime = `${formatDate(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const waterCut = calcWaterCut(data.oilProduction, data.waterProduction)

  const existing = findRecord(data.wellId, data.reportDate)
  if (existing) {
    Object.assign(existing, {
      productionHours: data.productionHours,
      oilProduction: data.oilProduction,
      waterProduction: data.waterProduction,
      gasProduction: data.gasProduction,
      tubingPressure: data.tubingPressure,
      casingPressure: data.casingPressure,
      status: data.status,
      waterCut,
      updateTime
    })
    return existing
  }

  const created: ProductionRecord = {
    id: nextId++,
    wellId: data.wellId,
    wellName: well?.wellName ?? `井${data.wellId}`,
    reportDate: data.reportDate,
    productionHours: data.productionHours,
    oilProduction: data.oilProduction,
    waterProduction: data.waterProduction,
    gasProduction: data.gasProduction,
    tubingPressure: data.tubingPressure,
    casingPressure: data.casingPressure,
    status: data.status,
    waterCut,
    updateTime
  }
  store.push(created)
  return created
}
