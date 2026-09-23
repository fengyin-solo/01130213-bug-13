<template>
  <div class="production-container">
    <el-card class="mb-20">
      <el-form :model="query" inline>
        <el-form-item label="井">
          <el-select v-model="query.wellId" placeholder="选择井" style="width: 180px" @change="onConditionChange">
            <el-option v-for="well in wellList" :key="well.id" :label="well.wellName" :value="well.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="query.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            @change="onConditionChange"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 130px" @change="onConditionChange">
            <el-option label="正常" value="正常" />
            <el-option label="异常" value="异常" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadAll">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-tooltip content="打开后所有数据接口将返回失败，用于验证旧内容被清理" placement="top">
            <el-switch v-model="query.mockError" active-text="模拟接口失败" inline-prompt @change="onConditionChange" />
          </el-tooltip>
        </el-form-item>
      </el-form>
    </el-card>

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
      <el-col :span="4">
        <div class="stat-card primary">
          <div class="stat-icon"><el-icon><Odometer /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ fmt(dailyData?.oilProduction) }}</div>
            <div class="stat-label">日产油量(t)</div>
          </div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card success">
          <div class="stat-icon"><el-icon><WaterCold /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ fmt(dailyData?.waterProduction) }}</div>
            <div class="stat-label">日产水量(t)</div>
          </div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card warning">
          <div class="stat-icon"><el-icon><TrendCharts /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ fmt(dailyData?.waterCut) }}%</div>
            <div class="stat-label">含水率</div>
          </div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card info">
          <div class="stat-icon"><el-icon><Clock /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ fmt(dailyData?.productionHours) }}h</div>
            <div class="stat-label">生产时数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card danger">
          <div class="stat-icon"><el-icon><Gauge /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ fmt(dailyData?.tubingPressure) }}MPa</div>
            <div class="stat-label">油压</div>
          </div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card purple">
          <div class="stat-icon"><el-icon><CircleClose /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ fmt(dailyData?.casingPressure) }}MPa</div>
            <div class="stat-label">套压</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-alert
      v-if="locatedDate && !errorMsg"
      type="info"
      :closable="true"
      show-icon
      class="mb-20"
      @close="clearLocate"
    >
      已定位到 {{ locatedDate }} 的数据（点击趋势图数据点定位，指标卡同步切换）
    </el-alert>

    <el-row v-if="!errorMsg" :gutter="20" class="mb-20">
      <el-col :span="16">
        <el-card v-loading="loading">
          <template #header>
            <div class="card-header">
              <span>产量趋势</span>
              <el-radio-group v-model="chartType" size="small">
                <el-radio-button label="oil">产油量</el-radio-button>
                <el-radio-button label="water">产水量</el-radio-button>
                <el-radio-button label="waterCut">含水率</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div v-show="!loading && trendData.length > 0" ref="trendChartRef" class="chart-large"></div>
          <el-empty v-if="!loading && trendData.length === 0" description="暂无趋势数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card v-loading="loading">
          <template #header>
            <span>累计产量（当前筛选口径）</span>
          </template>
          <div class="cumulative-stats">
            <div class="cumulative-item">
              <div class="cumulative-label">累计产油(万t)</div>
              <div class="cumulative-value">{{ summary ? wan(summary.totalOil) : dash }}</div>
            </div>
            <div class="cumulative-item">
              <div class="cumulative-label">累计产水(万t)</div>
              <div class="cumulative-value">{{ summary ? wan(summary.totalWater) : dash }}</div>
            </div>
            <div class="cumulative-item">
              <div class="cumulative-label">累计产气(万m³)</div>
              <div class="cumulative-value">{{ summary ? wan(summary.totalGas) : dash }}</div>
            </div>
            <div class="cumulative-item">
              <div class="cumulative-label">综合含水率(%)</div>
              <div class="cumulative-value">{{ summary ? fmt(summary.waterCut) : dash }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="!errorMsg">
      <template #header>
        <div class="card-header">
          <span>生产数据列表（{{ filteredRecords.length }} 条）</span>
        </div>
      </template>
      <el-table
        :data="pagedRecords"
        :row-class-name="rowClassName"
        border
        stripe
        style="width: 100%"
        v-loading="loading"
        @sort-change="onSortChange"
      >
        <el-table-column prop="reportDate" label="日期" width="120" sortable="custom" />
        <el-table-column prop="wellName" label="井名" width="100" />
        <el-table-column prop="productionHours" label="生产时数(h)" width="120" sortable="custom" />
        <el-table-column prop="oilProduction" label="产油量(t)" width="110" sortable="custom" />
        <el-table-column prop="waterProduction" label="产水量(t)" width="110" sortable="custom" />
        <el-table-column prop="gasProduction" label="产气量(m³)" width="120" sortable="custom" />
        <el-table-column prop="waterCut" label="含水率(%)" width="160" sortable="custom">
          <template #default="{ row }">
            <el-progress :percentage="Number(row.waterCut)" :stroke-width="12" :show-text="true" />
          </template>
        </el-table-column>
        <el-table-column prop="tubingPressure" label="油压(MPa)" width="110" />
        <el-table-column prop="casingPressure" label="套压(MPa)" width="110" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === '异常' ? 'danger' : 'success'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="goDetail(row)">详情</el-button>
            <el-button type="primary" size="small" link @click="openEdit(row)">修正</el-button>
          </template>
        </el-table-column>
        <template #empty>暂无生产数据</template>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="filteredRecords.length"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        class="mt-20"
      />
    </el-card>

    <el-dialog v-model="editVisible" title="修正生产数据" width="560px">
      <el-form :model="editForm" :rules="editRules" ref="editFormRef" label-width="110px">
        <el-form-item label="井">
          <el-input :model-value="editWellName" disabled />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="editForm.reportDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" disabled />
        </el-form-item>
        <el-form-item label="生产时数(h)" prop="productionHours">
          <el-input-number v-model="editForm.productionHours" :min="0" :max="24" :precision="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="产油量(t)" prop="oilProduction">
          <el-input-number v-model="editForm.oilProduction" :min="0" :precision="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="产水量(t)" prop="waterProduction">
          <el-input-number v-model="editForm.waterProduction" :min="0" :precision="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="产气量(m³)" prop="gasProduction">
          <el-input-number v-model="editForm.gasProduction" :min="0" :precision="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="油压(MPa)" prop="tubingPressure">
          <el-input-number v-model="editForm.tubingPressure" :precision="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="套压(MPa)" prop="casingPressure">
          <el-input-number v-model="editForm.casingPressure" :precision="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="editForm.status" style="width: 100%">
            <el-option label="正常" value="正常" />
            <el-option label="异常" value="异常" />
          </el-select>
        </el-form-item>
        <el-form-item label="含水率">
          <el-tag type="warning">{{ editWaterCut }}%</el-tag>
          <span class="form-tip">按 水/(油+水) 自动计算，修正提交后列表、指标卡、累计面板同步重算</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存修正</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { ElMessage, FormInstance } from 'element-plus'
import { getWellList } from '@/api/well'
import {
  ProductionFormData,
  getProductionDaily,
  getProductionList,
  getProductionSummary,
  getProductionTrend,
  submitProductionData
} from '@/api/production'
import {
  METRIC_LABELS,
  ProductionMetric,
  ProductionRecord,
  ProductionSummary,
  TrendPoint,
  WellInfo,
  calcWaterCut,
  defaultDateRange,
  latestRecord,
  round2
} from '@/utils/production'

const route = useRoute()
const router = useRouter()

const dash = '—'
const fmt = (v?: number | null) => (v === null || v === undefined || Number.isNaN(v) ? dash : String(v))
const wan = (v: number) => (v / 10000).toFixed(2)

// ---- 筛选条件（从明细详情返回时由路由 query 恢复）----
const [defaultStart, defaultEnd] = defaultDateRange()
const query = reactive({
  wellId: 1 as number,
  dateRange: [defaultStart, defaultEnd] as [string, string] | null,
  status: '',
  mockError: false
})

const wellList = ref<WellInfo[]>([])
const loading = ref(false)
const errorMsg = ref('')

// 三处面板 + 指标卡的数据源，同一批次刷新
const productionList = ref<ProductionRecord[]>([])
const trendData = ref<TrendPoint[]>([])
const summary = ref<ProductionSummary | null>(null)
const dailyData = ref<ProductionRecord | null>(null)

const chartType = ref<ProductionMetric>('oil')
const locatedDate = ref('')
const trendChartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const pagination = reactive({ page: 1, size: 10 })
const sortState = reactive<{ prop: string; order: 'ascending' | 'descending' | null }>({
  prop: 'reportDate',
  order: 'descending'
})

/** 列表排序只重排列表，数据仍与卡片/趋势同源 */
const filteredRecords = computed(() => {
  const list = [...productionList.value]
  if (sortState.prop && sortState.order) {
    const dir = sortState.order === 'ascending' ? 1 : -1
    list.sort((a, b) => {
      const av = (a as any)[sortState.prop]
      const bv = (b as any)[sortState.prop]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av) < String(bv) ? -dir : String(av) > String(bv) ? dir : 0
    })
  }
  return list
})

const pagedRecords = computed(() => {
  const start = (pagination.page - 1) * pagination.size
  return filteredRecords.value.slice(start, start + pagination.size)
})

function buildParams() {
  return {
    wellId: query.wellId,
    startDate: query.dateRange?.[0],
    endDate: query.dateRange?.[1],
    status: query.status || undefined,
    mockError: query.mockError || undefined
  }
}

/** 清空全部旧内容：空结果 / 接口失败时不允许残留上一组井或上一个日期的数据 */
function clearAll() {
  productionList.value = []
  trendData.value = []
  summary.value = null
  dailyData.value = null
  renderChart()
}

/**
 * 唯一的数据编排入口：指标卡、趋势图、累计面板、列表同批次刷新。
 * 任意接口失败 → 清理旧内容并展示错误；成功但无数据 → 展示空态。
 */
let requestSeq = 0
async function loadAll() {
  const seq = ++requestSeq
  errorMsg.value = ''
  loading.value = true
  // 先清空，防止请求期间继续展示上一组数据
  clearAll()
  const params = buildParams()
  try {
    const [listRes, dailyRes, trendRes, summaryRes] = await Promise.all([
      getProductionList(params),
      getProductionDaily(params.wellId, params),
      getProductionTrend(params.wellId, params),
      getProductionSummary(params)
    ])
    // 快速切换井/日期时，只采用最后一次请求的结果，避免旧数据覆盖新筛选
    if (seq !== requestSeq) return

    productionList.value = listRes.list
    trendData.value = trendRes
    summary.value = summaryRes
    dailyData.value = locatedDate.value
      ? listRes.list.find(r => r.reportDate === locatedDate.value) || dailyRes
      : dailyRes
    if (locatedDate.value && !listRes.list.some(r => r.reportDate === locatedDate.value)) {
      locatedDate.value = ''
    }
    renderChart()
    syncPaginationToLocated()
  } catch (e: any) {
    if (seq !== requestSeq) return
    clearAll()
    errorMsg.value = e?.message || '数据加载失败，已清理当前展示内容'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function onConditionChange() {
  // 条件变化后定位失效，回到“最新一天”口径
  locatedDate.value = ''
  pagination.page = 1
  loadAll()
}

function handleReset() {
  const [s, e] = defaultDateRange()
  query.wellId = wellList.value[0]?.id ?? 1
  query.dateRange = [s, e]
  query.status = ''
  query.mockError = false
  locatedDate.value = ''
  sortState.prop = 'reportDate'
  sortState.order = 'descending'
  pagination.page = 1
  loadAll()
}

function onSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  sortState.prop = prop
  sortState.order = order
  syncPaginationToLocated()
}

function rowClassName({ row }: { row: ProductionRecord }) {
  return row.reportDate === locatedDate.value ? 'located-row' : ''
}

function syncPaginationToLocated() {
  if (!locatedDate.value) return
  const idx = filteredRecords.value.findIndex(r => r.reportDate === locatedDate.value)
  if (idx >= 0) pagination.page = Math.floor(idx / pagination.size) + 1
}

// ---- 趋势图：点击数据点 → 定位某天，指标卡/列表同步 ----
function renderChart() {
  if (!chart) return
  if (trendData.value.length === 0) {
    chart.clear()
    return
  }
  chart.resize()
  const metric = chartType.value
  const valueKey = metric === 'oil' ? 'oilProduction' : metric === 'water' ? 'waterProduction' : 'waterCut'
  const color = metric === 'oil' ? '#3b82f6' : metric === 'water' ? '#22c55e' : '#f59e0b'
  const data = trendData.value.map(p => (p as any)[valueKey])
  const locatedIndex = locatedDate.value
    ? trendData.value.findIndex(p => p.reportDate === locatedDate.value)
    : -1
  chart.setOption(
    {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v: any) => `${v}${metric === 'waterCut' ? '%' : 't'}`
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trendData.value.map(p => p.reportDate.slice(5))
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: METRIC_LABELS[metric],
          type: 'line',
          smooth: true,
          symbolSize: (value: number, params: any) => (params.dataIndex === locatedIndex ? 12 : 6),
          areaStyle: { color: color + '1A' },
          itemStyle: {
            color: (params: any) => (params.dataIndex === locatedIndex ? '#dc2626' : color)
          },
          data,
          markLine:
            locatedIndex >= 0
              ? {
                  symbol: 'none',
                  lineStyle: { color: '#dc2626', type: 'dashed' },
                  data: [{ xAxis: locatedIndex }]
                }
              : undefined
        }
      ]
    },
    true
  )
}

function handleChartClick(params: any) {
  const point = trendData.value[params.dataIndex]
  if (!point) return
  locatedDate.value = point.reportDate
  dailyData.value = productionList.value.find(r => r.reportDate === point.reportDate) || null
  if (!dailyData.value) {
    ElMessage.warning(`${point.reportDate} 在当前状态过滤下无明细记录`)
  }
  nextTick(syncPaginationToLocated)
  renderChart()
}

function clearLocate() {
  locatedDate.value = ''
  // 恢复到当前筛选窗口内的最新一天
  dailyData.value = latestRecord(productionList.value)
  renderChart()
}

watch(chartType, () => renderChart())

// ---- 修正弹窗 ----
const editVisible = ref(false)
const submitting = ref(false)
const editFormRef = ref<FormInstance>()
const editForm = reactive<ProductionFormData>({
  id: undefined,
  wellId: 0,
  reportDate: '',
  productionHours: 24,
  oilProduction: 0,
  waterProduction: 0,
  gasProduction: 0,
  tubingPressure: 0,
  casingPressure: 0,
  status: '正常'
})
const editRules = {
  reportDate: [{ required: true, message: '请选择日期', trigger: 'change' }],
  oilProduction: [{ required: true, message: '请输入产油量', trigger: 'blur' }],
  waterProduction: [{ required: true, message: '请输入产水量', trigger: 'blur' }]
}
const editWellName = computed(
  () => wellList.value.find(w => w.id === editForm.wellId)?.wellName || ''
)
const editWaterCut = computed(() =>
  round2(calcWaterCut(editForm.oilProduction || 0, editForm.waterProduction || 0))
)

function openEdit(row: ProductionRecord) {
  Object.assign(editForm, {
    id: row.id,
    wellId: row.wellId,
    reportDate: row.reportDate,
    productionHours: row.productionHours,
    oilProduction: row.oilProduction,
    waterProduction: row.waterProduction,
    gasProduction: row.gasProduction,
    tubingPressure: row.tubingPressure,
    casingPressure: row.casingPressure,
    status: row.status,
    mockError: undefined
  })
  editVisible.value = true
}

async function handleSubmit() {
  if (!editFormRef.value || submitting.value) return
  await editFormRef.value.validate(async valid => {
    if (!valid) return
    submitting.value = true
    try {
      // 同井同日重复提交只覆盖不累加；保存成功后统一刷新三处面板
      await submitProductionData({ ...editForm, mockError: query.mockError || undefined })
      ElMessage.success('修正已保存（同井同日重复提交不会重复累计产量）')
      editVisible.value = false
      await loadAll()
    } catch (e: any) {
      // 错误提示已由请求拦截器统一处理
    } finally {
      submitting.value = false
    }
  })
}

// ---- 明细详情：携带当前筛选条件，返回列表时恢复 ----
function goDetail(row: ProductionRecord) {
  router.push({
    path: '/production/detail',
    query: {
      wellId: String(row.wellId),
      reportDate: row.reportDate,
      fWellId: String(query.wellId),
      fStart: query.dateRange?.[0] || '',
      fEnd: query.dateRange?.[1] || '',
      fStatus: query.status || '',
      fMockError: query.mockError ? '1' : ''
    }
  })
}

function restoreQueryFromRoute() {
  const q = route.query
  if (!q.fWellId) return false
  query.wellId = Number(q.fWellId) || 1
  query.dateRange = q.fStart && q.fEnd ? [String(q.fStart), String(q.fEnd)] : null
  query.status = String(q.fStatus || '')
  query.mockError = q.fMockError === '1'
  return true
}

function handleResize() {
  chart?.resize()
}

onMounted(async () => {
  const restored = restoreQueryFromRoute()
  try {
    wellList.value = await getWellList({})
    if (!restored && !wellList.value.some(w => w.id === query.wellId)) {
      query.wellId = wellList.value[0]?.id ?? 1
    }
  } catch {
    wellList.value = []
  }
  await nextTick()
  if (trendChartRef.value) {
    chart = echarts.init(trendChartRef.value)
    chart.on('click', handleChartClick)
    window.addEventListener('resize', handleResize)
  }
  loadAll()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped lang="scss">
.production-container {
  width: 100%;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-radius: 8px;
  color: #fff;

  &.primary { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
  &.success { background: linear-gradient(135deg, #22c55e, #16a34a); }
  &.warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
  &.info { background: linear-gradient(135deg, #06b6d4, #0891b2); }
  &.danger { background: linear-gradient(135deg, #ef4444, #dc2626); }
  &.purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }

  .stat-icon {
    font-size: 36px;
    opacity: 0.9;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 600;
    line-height: 1;
    margin-bottom: 5px;
  }

  .stat-label {
    font-size: 14px;
    opacity: 0.9;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.chart-large {
  width: 100%;
  height: 300px;
}

.cumulative-stats {
  padding: 10px 0;
}

.cumulative-item {
  padding: 16px 0;
  border-bottom: 1px solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }

  .cumulative-label {
    font-size: 14px;
    color: #64748b;
    margin-bottom: 8px;
  }

  .cumulative-value {
    font-size: 30px;
    font-weight: 600;
    color: #1e293b;
  }
}

.text-right {
  text-align: right;
}

.mt-20 {
  margin-top: 20px;
}

.form-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #94a3b8;
}

:deep(.located-row) {
  background-color: #fef2f2 !important;
}
</style>
