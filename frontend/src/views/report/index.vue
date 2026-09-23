<template>
  <div class="report-container">
    <el-card class="mb-20">
      <template #header>
        <div class="card-header">
          <span>报表中心</span>
        </div>
      </template>

      <el-form :inline="true" class="filter-form">
        <el-form-item label="报表类型">
          <el-select v-model="reportType" style="width: 160px">
            <el-option label="生产日报" value="daily" />
            <el-option label="生产周报" value="weekly" />
            <el-option label="生产月报" value="monthly" />
          </el-select>
        </el-form-item>
        <el-form-item label="井位">
          <el-select
            v-model="selectedWells"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="全部井"
            clearable
            style="width: 240px"
          >
            <el-option v-for="well in wellList" :key="well.id" :label="well.wellName" :value="well.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 280px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button @click="handleExport">导出Excel</el-button>
        </el-form-item>
      </el-form>

      <el-row :gutter="20" class="mb-20" v-loading="summaryLoading">
        <el-col :span="8">
          <div class="summary-card">
            <div class="summary-label">总产油量</div>
            <div class="summary-value">{{ formatNumber(summary?.totalOil) }}</div>
            <div class="summary-unit">吨</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="summary-card">
            <div class="summary-label">总产水量</div>
            <div class="summary-value">{{ formatNumber(summary?.totalWater) }}</div>
            <div class="summary-unit">吨</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="summary-card">
            <div class="summary-label">平均含水率</div>
            <div class="summary-value">{{ summary ? summary.avgWaterCut : '--' }}</div>
            <div class="summary-unit">%</div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="mb-20">
        <el-col :span="16">
          <div class="chart-box" v-loading="trendLoading">
            <h4>产量趋势分析（{{ typeLabel }}，与明细同一时间口径）</h4>
            <div ref="trendChart" class="chart-large"></div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="chart-box" v-loading="summaryLoading">
            <h4>区块产油占比</h4>
            <div ref="pieChart" class="chart-medium"></div>
          </div>
        </el-col>
      </el-row>

      <div class="table-box">
        <h4>详细数据</h4>
        <el-table :data="reportData" border stripe style="width: 100%" v-loading="listLoading">
          <el-table-column prop="reportDate" label="日期" width="120" />
          <el-table-column prop="wellName" label="井名" width="100" />
          <el-table-column prop="blockName" label="区块" width="100" />
          <el-table-column prop="oilProduction" label="产油量(t)" width="120" />
          <el-table-column prop="waterProduction" label="产水量(t)" width="120" />
          <el-table-column prop="gasProduction" label="产气量(m³)" width="130" />
          <el-table-column prop="waterCut" label="含水率(%)" width="180">
            <template #default="{ row }">
              <el-progress :percentage="Number(row.waterCut)" :stroke-width="10" />
            </template>
          </el-table-column>
          <el-table-column prop="productionHours" label="生产时长(h)" width="120" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === '正常' ? 'success' : row.status === '异常' ? 'warning' : 'danger'" size="small">
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="当前时间范围/井位条件下暂无数据" />
          </template>
        </el-table>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          class="mt-20"
          @size-change="handlePageChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import {
  getProductionWells,
  getProductionList,
  getProductionTrend,
  getProductionSummary
} from '@/api/production'
import { buildProductionQuery } from '@/api/productionQuery'
import { defaultDateRange } from '@/utils/date'
import type { ProductionRow, ProductionSummaryData, TrendPoint, Well } from '@/mock/productionDb'

const reportType = ref('daily')
const dateRange = ref<[Date, Date] | ''>(defaultDateRange(30))
const selectedWells = ref<number[]>([])
const wellList = ref<Well[]>([])

const reportData = ref<ProductionRow[]>([])
const trendData = ref<TrendPoint[]>([])
const summary = ref<ProductionSummaryData | null>(null)

const listLoading = ref(false)
const trendLoading = ref(false)
const summaryLoading = ref(false)

const pagination = reactive({ page: 1, size: 10, total: 0 })

const typeLabel = computed(() => ({ daily: '日', weekly: '周', monthly: '月' }[reportType.value] || '日'))
const granularity = computed(() => ({ daily: 'day', weekly: 'week', monthly: 'month' }[reportType.value] || 'day'))

const trendChart = ref<HTMLElement>()
const pieChart = ref<HTMLElement>()
let trendInstance: echarts.ECharts | null = null
let pieInstance: echarts.ECharts | null = null

let panelsSeq = 0
let listSeq = 0

const baseQuery = () =>
  buildProductionQuery({
    wellIds: selectedWells.value,
    dateRange: dateRange.value
  })

/** 汇总、趋势、明细共用同一时间口径参数 */
const loadAll = () => {
  loadPanels()
  loadList()
}

const loadPanels = async () => {
  const seq = ++panelsSeq
  const query = baseQuery()

  summaryLoading.value = true
  getProductionSummary(query)
    .then((res) => {
      if (seq === panelsSeq) summary.value = res.data
    })
    .catch(() => {
      if (seq === panelsSeq) summary.value = null
      ElMessage.error('汇总数据加载失败，已清空旧汇总')
    })
    .finally(() => {
      if (seq === panelsSeq) summaryLoading.value = false
    })

  trendLoading.value = true
  getProductionTrend({ ...query, granularity: granularity.value })
    .then((res) => {
      if (seq === panelsSeq) trendData.value = res.data
    })
    .catch(() => {
      if (seq === panelsSeq) trendData.value = []
      ElMessage.error('趋势数据加载失败，已清空旧趋势')
    })
    .finally(() => {
      if (seq === panelsSeq) trendLoading.value = false
    })
}

const loadList = async () => {
  const seq = ++listSeq
  listLoading.value = true
  try {
    const res = await getProductionList({
      ...baseQuery(),
      sortField: 'reportDate',
      sortOrder: 'descending',
      page: pagination.page,
      size: pagination.size
    })
    if (seq !== listSeq) return
    reportData.value = res.data.rows
    pagination.total = res.data.total
  } catch {
    if (seq === listSeq) {
      reportData.value = []
      pagination.total = 0
      ElMessage.error('明细数据加载失败，已清空旧明细')
    }
  } finally {
    if (seq === listSeq) listLoading.value = false
  }
}

const handleQuery = () => {
  pagination.page = 1
  loadAll()
}

const handlePageChange = () => {
  loadList()
}

const handleReset = () => {
  reportType.value = 'daily'
  selectedWells.value = []
  dateRange.value = defaultDateRange(30)
  pagination.page = 1
  loadAll()
}

const handleExport = () => {
  ElMessage.success('已按当前井位与时间范围生成导出任务')
}

// 切换报表类型只改变趋势聚合粒度，时间范围不变（同一口径）
watch(reportType, () => {
  pagination.page = 1
  loadAll()
})
watch(selectedWells, () => {
  pagination.page = 1
  loadAll()
}, { deep: false })
watch(dateRange, () => {
  pagination.page = 1
  loadAll()
})

const renderTrendChart = () => {
  if (!trendInstance) return
  if (!trendData.value.length) {
    trendInstance.clear()
    trendInstance.setOption({
      title: {
        text: '暂无趋势数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 14, fontWeight: 'normal' }
      }
    })
    return
  }
  trendInstance.setOption(
    {
      title: { text: '' },
      tooltip: { trigger: 'axis' },
      legend: { data: ['产油量', '产水量'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trendData.value.map((p) => p.date.slice(5))
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '产油量',
          type: 'line',
          smooth: true,
          areaStyle: { color: 'rgba(59,130,246,0.1)' },
          itemStyle: { color: '#3b82f6' },
          data: trendData.value.map((p) => p.oilProduction)
        },
        {
          name: '产水量',
          type: 'line',
          smooth: true,
          areaStyle: { color: 'rgba(34,197,94,0.1)' },
          itemStyle: { color: '#22c55e' },
          data: trendData.value.map((p) => p.waterProduction)
        }
      ]
    },
    true
  )
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

const renderPieChart = () => {
  if (!pieInstance) return
  const blockData = summary.value?.blockProduction || []
  if (!blockData.length) {
    pieInstance.clear()
    pieInstance.setOption({
      title: {
        text: '暂无区块数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 14, fontWeight: 'normal' }
      }
    })
    return
  }
  pieInstance.setOption(
    {
      title: { text: '' },
      tooltip: { trigger: 'item', formatter: '{b}: {c}t ({d}%)' },
      legend: { orient: 'vertical', left: 'left' },
      series: [
        {
          name: '区块产油',
          type: 'pie',
          radius: ['40%', '70%'],
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '{b}: {d}%' },
          data: blockData.map((item, index) => ({
            value: item.oilProduction,
            name: item.blockName,
            itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] }
          }))
        }
      ]
    },
    true
  )
}

const handleResize = () => {
  trendInstance?.resize()
  pieInstance?.resize()
}

watch(trendData, () => renderTrendChart())
watch(summary, () => renderPieChart())

const formatNumber = (value?: number) => {
  if (value === null || value === undefined) return '--'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

onMounted(async () => {
  await nextTick()
  if (trendChart.value) trendInstance = echarts.init(trendChart.value)
  if (pieChart.value) pieInstance = echarts.init(pieChart.value)
  renderTrendChart()
  renderPieChart()
  window.addEventListener('resize', handleResize)

  try {
    const res = await getProductionWells()
    wellList.value = res.data
    await loadAll()
  } catch {
    wellList.value = []
    summary.value = null
    trendData.value = []
    reportData.value = []
    pagination.total = 0
    renderTrendChart()
    renderPieChart()
    ElMessage.error('报表初始化失败，已清空旧内容')
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  trendInstance?.dispose()
  pieInstance?.dispose()
  trendInstance = null
  pieInstance = null
})
</script>

<style scoped lang="scss">
.report-container {
  width: 100%;
}

.filter-form {
  margin-bottom: 0;
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
    font-size: 14px;
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

.mt-20 {
  margin-top: 20px;
}
</style>
