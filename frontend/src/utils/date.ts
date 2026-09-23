// 日期工具：生产运营页与报表分析页共用，保证两处时间口径完全一致
// 统一使用本地时区的 YYYY-MM-DD，按“自然日”闭区间过滤，避免 UTC 偏移造成的错位

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 格式化为 YYYY-MM-DD（本地时区） */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 解析 YYYY-MM-DD 为本地日期对象 */
export function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** 图表轴标签：day/week 显示 MM-DD，month 显示 YYYY-MM */
export function formatTrendLabel(key: string, granularity: string): string {
  if (granularity === 'month') return key
  const d = parseDate(key)
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** el-date-picker daterange 的值统一归一化为接口参数（闭区间） */
export function normalizeDateRange(value: unknown): { startDate?: string; endDate?: string } {
  if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
    const start = value[0] instanceof Date ? value[0] : new Date(value[0])
    const end = value[1] instanceof Date ? value[1] : new Date(value[1])
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const [s, e] = start.getTime() <= end.getTime() ? [start, end] : [end, start]
      return { startDate: formatDate(s), endDate: formatDate(e) }
    }
  }
  return {}
}

/** 默认时间范围：最近 days 个自然日（含今天） */
export function defaultDateRange(days = 30): [Date, Date] {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  return [start, new Date(end)]
}
