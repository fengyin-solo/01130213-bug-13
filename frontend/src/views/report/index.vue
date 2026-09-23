<template>
  <div class="report-container">
    <el-card class="mb-20">
      <template #header>
        <div class="card-header">
          <span>报表中心</span>
          <el-tooltip content="打开后数据接口返回失败，用于验证旧内容被清理" placement="top">
            <el-switch v-model="mockError" active-text="模拟接口失败" inline-prompt />
          </el-tooltip>
        </div>
      </template>

      <el-form inline>
        <el-form-item label="报表类型">
          <el-select v-model="reportType" style="width: 150px" @change="loadAll">
            <el-option label="生产日报" value="daily" />
            <el-option label="生产周报" value="weekly" />
            <el-option label="生产月报" value="monthly" />
          </el-select>
        </el-form-item>
        <el-form-item label="井">
          <el-select
            v-model="selectedWells"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="全部井"
            clearable
            style="width: 260px"
            @change="onConditionChange"
          >
            <el-option v-for="well in wellList" :key="well.id" :label="well.wellName" :value="well.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            @change="onConditionChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadAll">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="errorMsg"
        :title="errorMsg"
        type="error"
        show-icon
        :closable="false"
        class="mb-20"
      >
        <el-button type="primary" size="small" @click="loadAll">重新加载</el-button>
      </el-alert>

      <el-row v-if="!errorMsg" :gutter="20" class="mb-20">
        <el-col :span="8">
          <div class="summary-card">
            <div class="summary-label">总产油量（当前时间口径）</div>
            <div class="summary-value">{{ summary ? summary.totalOil.toLocaleString() : dash }}</div>
            <div class="summary-unit">吨 · {{ summary?.recordCount ?? 0 }} 条明细</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="summary-card">
            <div class="summary-label">总产水量（当前时间口径）</div>
            <div class="summary-value">{{ summary ? summary.totalWater.toLocaleString() : dash }}</div>
            <div class="summary-unit">吨</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="summary-card">
            <div class="summary-label">综合含水率</div>
            <div class="summary-value">{{ summary ? fmt(summary.waterCut) : dash }}</div>
            <div class="summary-unit">% · 按液量加权，与明细表同一公式</div>
          </div>
        </el-col>
      </el-row>

      <el-row v-if="!errorMsg" :gutter="20" class="mb-20">
        <el-col :span="16">
          <div class="chart-box">
            <h4>产量趋势分析（与生产运营列表同一筛选口径）</h4>
            <div v-show="!loading && trendData.length > 0" ref="trendChartRef" class="chart-large"></div>
            <el-empty v-if="!loading && trendData.length === 0" description="暂无趋势数据" :image-size="80" />
          </div>
        </el-col>
        <el-col :span="8">
          <div class="chart-box">
            <h4>井产量占比</h4>
            <div v-show="!loading && wellPie.length > 0" ref="pieChartRef" class="chart-medium"></div>
            <el-empty v-if="!loading && wellPie.length === 0" description="暂无占比数据" :image-size="80" />
          </div>
        </el-col>
      </el-row>

      <div v-if="!errorMsg" class="table-box">
        <h4>详细数据（汇总由这一批明细聚合得到）</h4>
        <el-table :data="tableData" border stripe v-loading="loading" style="width: 100%">
          <el-table-column prop="reportDate" label="日期" width="120" />
          <el-table-column prop="wellName" label="井名" width="100" />
          <el-table-column prop="oilProduction" label="产油量(t)" width="110" />
          <el-table-column prop="waterProduction" label="产水量(t)" width="110" />
          <el-table-column prop="gasProduction" label="产气量(m³)" width="120" />
          <el-table-column prop="waterCut" label="含水率(%)" width="180">
            <template #default="{ row }">
              <el-progress :percentage="Number(row.waterCut)" :stroke-width="10" />
            </template>
          </el-table-column>
          <el-table-column prop="productionHours" label="生产时长(h)" width="110" />
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === '异常' ? 'danger' : 'success'" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <template #empty>暂无明细数据</template>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts'
import { getWellList } from '@/api/well'
import {
  getProductionList,
  getProductionSummary,
  getProductionTrendMulti
} from '@/api/production'
import {
  ProductionRecord,
  ProductionSummary,
  TrendPoint,
  WellInfo,
  defaultDateRange,
  filterRecords
} from '@/utils/production'

const dash = '—'
const fmt = (v?: number | null) => (v === null || v === undefined || Number.isNaN(v) ? dash : String(v))

const reportType = ref<'daily' | 'weekly' | 'monthly'>('daily')
const [defaultStart, defaultEnd] = defaultDateRange()
const dateRange = ref<[string, string] | null>([defaultStart, defaultEnd])
const selectedWells = ref<number[]>([])
const mockError = ref(false)

const wellList = ref<WellInfo[]>([])
const loading = ref(false)
const errorMsg = ref('')

const tableData = ref<ProductionRecord[]>([])
const trendData = ref<TrendPoint[]>([])
const summary = ref<ProductionSummary | null>(null)

const trendChartRef = ref<HTMLElement>()
const pieChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null

/** 占比图同样由“当前筛选后的明细”计算，保证与汇总数值一致 */
const wellPie = computed(() => {
  return wellList.value
    .map(w => {
      const oil = filterRecords(tableData.value, { wellId: w.id }).reduce((s, r) => s + r.oilProduction, 0)
      return { name: w.wellName, value: Math.round(oil * 100) / 100 }
    })
    .filter(item => item.value > 0)
})

function buildParams() {
  return {
    wellIds: selectedWells.value.length ? selectedWells.value : undefined,
    startDate: dateRange.value?.[0],
    endDate: dateRange.value?.[1],
    mockError: mockError.value || undefined
  }
}

function clearAll() {
  tableData.value = []
  trendData.value = []
  summary.value = null
  renderTrend()
  renderPie()
}

/** 唯一刷新入口：汇总卡、趋势、占比、明细同批次加载，失败时清空旧内容 */
async function loadAll() {
  errorMsg.value = ''
  loading.value = true
  clearAll()
  const params = buildParams()
  try {
    const [listRes, summaryRes, trendRes] = await Promise.all([
      getProductionList(params),
      getProductionSummary(params),
      getProductionTrendMulti({ ...params, period: reportType.value })
    ])
    tableData.value = listRes.list
    summary.value = summaryRes
    trendData.value = trendRes
    renderTrend()
    renderPie()
  } catch (e: any) {
    clearAll()
    errorMsg.value = e?.message || '数据加载失败，已清理当前展示内容'
  } finally {
    loading.value = false
  }
}

function onConditionChange() {
  loadAll()
}

function handleReset() {
  const [s, e] = defaultDateRange()
  dateRange.value = [s, e]
  selectedWells.value = []
  reportType.value = 'daily'
  mockError.value = false
  loadAll()
}

function renderTrend() {
  if (!trendChart) return
  if (trendData.value.length === 0) {
    trendChart.clear()
    return
  }
  trendChart.resize()
  trendChart.setOption(
    {
      tooltip: { trigger: 'axis' },
      legend: { data: ['产油量', '产水量'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trendData.value.map(p => p.reportDate)
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '产油量',
          type: 'line',
          smooth: true,
          data: trendData.value.map(p => p.oilProduction),
          itemStyle: { color: '#3b82f6' },
          areaStyle: { color: 'rgba(59,130,246,0.1)' }
        },
        {
          name: '产水量',
          type: 'line',
          smooth: true,
          data: trendData.value.map(p => p.waterProduction),
          itemStyle: { color: '#22c55e' },
          areaStyle: { color: 'rgba(34,197,94,0.1)' }
        }
      ]
    },
    true
  )
}

function renderPie() {
  if (!pieChart) return
  if (wellPie.value.length === 0) {
    pieChart.clear()
    return
  }
  pieChart.resize()
  pieChart.setOption(
    {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          name: '井产油',
          type: 'pie',
          radius: ['40%', '70%'],
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{d}%' },
          data: wellPie.value
        }
      ]
    },
    true
  )
}

function handleResize() {
  trendChart?.resize()
  pieChart?.resize()
}

onMounted(async () => {
  try {
    wellList.value = await getWellList({})
  } catch {
    wellList.value = []
  }
  await nextTick()
  if (trendChartRef.value) trendChart = echarts.init(trendChartRef.value)
  if (pieChartRef.value) pieChart = echarts.init(pieChartRef.value)
  window.addEventListener('resize', handleResize)
  loadAll()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  pieChart?.dispose()
})
</script>

<style scoped lang="scss">
.report-container {
  width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.summary-card {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: 8px;
  padding: 25px;
  text-align: center;

  .summary-label {
    font-size: 14px;
    color: #64748b;
    margin-bottom: 10px;
  }

  .summary-value {
    font-size: 36px;
    font-weight: 700;
    color: #1e293b;
    line-height: 1;
  }

  .summary-unit {
    font-size: 13px;
    color: #64748b;
    margin-top: 10px;
  }
}

.chart-box,
.table-box {
  background: #fff;
  border-radius: 8px;
  padding: 20px;

  h4 {
    margin: 0 0 15px 0;
    font-size: 16px;
    color: #1e293b;
  }
}

.chart-large {
  width: 100%;
  height: 280px;
}

.chart-medium {
  width: 100%;
  height: 280px;
}

.mb-20 {
  margin-bottom: 20px;
}
</style>
