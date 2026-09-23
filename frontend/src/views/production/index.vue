<template>
  <div class="production-container">
    <!-- 明细详情：从列表进入时筛选条件原样保留在后台 -->
    <el-card v-if="viewMode === 'detail' && detailRow" class="detail-card">
      <template #header>
        <div class="card-header">
          <div class="detail-header">
            <el-button :icon="ArrowLeftIcon" @click="closeDetail">返回列表</el-button>
            <span>生产明细详情（{{ detailRow.wellName }} · {{ detailRow.reportDate }}）</span>
          </div>
          <el-button type="primary" @click="openCorrect(detailRow)">修正数据</el-button>
        </div>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="日期">{{ detailRow.reportDate }}</el-descriptions-item>
        <el-descriptions-item label="井名">{{ detailRow.wellName }}</el-descriptions-item>
        <el-descriptions-item label="区块">{{ detailRow.blockName }}</el-descriptions-item>
        <el-descriptions-item label="生产时数(h)">{{ detailRow.productionHours }}</el-descriptions-item>
        <el-descriptions-item label="产油量(t)">{{ detailRow.oilProduction }}</el-descriptions-item>
        <el-descriptions-item label="产水量(t)">{{ detailRow.waterProduction }}</el-descriptions-item>
        <el-descriptions-item label="产气量(m³)">{{ detailRow.gasProduction }}</el-descriptions-item>
        <el-descriptions-item label="含水率(%)">
          <span :class="detailRow.waterCut >= 85 ? 'water-cut-danger' : ''">{{ detailRow.waterCut }}%</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(detailRow.status)" size="small">{{ detailRow.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="油压(MPa)">{{ detailRow.tubingPressure }}</el-descriptions-item>
        <el-descriptions-item label="套压(MPa)">{{ detailRow.casingPressure }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <template v-else>
      <el-card class="mb-20">
        <el-row :gutter="20">
          <el-col :span="6">
            <el-select v-model="selectedWell" placeholder="选择井" style="width: 100%">
              <el-option v-for="well in wellList" :key="well.id" :label="well.wellName" :value="well.id" />
            </el-select>
          </el-col>
          <el-col :span="7">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 100%"
            />
          </el-col>
          <el-col :span="6">
            <div class="locate-bar">
              <el-date-picker
                v-model="locateDate"
                type="date"
                placeholder="定位日期"
                value-format="YYYY-MM-DD"
                style="width: calc(100% - 72px)"
              />
              <el-button type="primary" plain @click="handleLocate">定位</el-button>
            </div>
          </el-col>
          <el-col :span="5" class="text-right">
            <el-button type="primary" @click="openCreate">数据采集</el-button>
            <el-button @click="handleImport">导入数据</el-button>
            <el-button @click="handleExport">导出报表</el-button>
          </el-col>
        </el-row>
        <el-row :gutter="20" class="filter-row">
          <el-col :span="6">
            <el-input v-model="filters.keyword" placeholder="搜索井名/日期" clearable>
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
          </el-col>
          <el-col :span="5">
            <el-select v-model="filters.status" placeholder="状态" clearable style="width: 100%">
              <el-option label="正常" value="正常" />
              <el-option label="异常" value="异常" />
              <el-option label="停井" value="停井" />
            </el-select>
          </el-col>
          <el-col :span="6">
            <div class="watercut-filter">
              <span class="watercut-label">含水率≥</span>
              <el-input-number
                v-model="filters.minWaterCut"
                :min="0"
                :max="100"
                :controls="false"
                placeholder="0"
                style="width: 110px"
              />
              <span class="watercut-label">%</span>
            </div>
          </el-col>
          <el-col :span="7" class="text-right">
            <el-button type="primary" @click="handleQuery">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-col>
        </el-row>
      </el-card>

      <el-row v-loading="cardLoading" :gutter="20" class="mb-20">
        <el-col :span="4">
          <div class="stat-card primary">
            <div class="stat-icon"><el-icon><Odometer /></el-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ formatMetric(dailyData?.oilProduction) }}</div>
              <div class="stat-label">日产油量(t)</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-card success">
            <div class="stat-icon"><el-icon><WaterCold /></el-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ formatMetric(dailyData?.waterProduction) }}</div>
              <div class="stat-label">日产水量(t)</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-card warning">
            <div class="stat-icon"><el-icon><TrendCharts /></el-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ dailyData ? dailyData.waterCut + '%' : '--' }}</div>
              <div class="stat-label">含水率</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-card info">
            <div class="stat-icon"><el-icon><Clock /></el-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ formatMetric(dailyData?.productionHours, 'h') }}</div>
              <div class="stat-label">生产时数</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-card danger">
            <div class="stat-icon"><el-icon><Gauge /></el-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ formatMetric(dailyData?.tubingPressure, 'MPa') }}</div>
              <div class="stat-label">油压</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-card purple">
            <div class="stat-icon"><el-icon><CircleClose /></el-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ formatMetric(dailyData?.casingPressure, 'MPa') }}</div>
              <div class="stat-label">套压</div>
            </div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="mb-20">
        <el-col :span="16">
          <el-card v-loading="trendLoading">
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
            <div ref="trendChart" class="chart-large"></div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card v-loading="summaryLoading">
            <template #header>
              <span>累计产量（当前筛选区间）</span>
            </template>
            <div class="cumulative-stats">
              <div class="cumulative-item">
                <div class="cumulative-label">累计产油(万t)</div>
                <div class="cumulative-value">{{ formatWan(summary?.totalOil) }}</div>
              </div>
              <div class="cumulative-item">
                <div class="cumulative-label">累计产水(万t)</div>
                <div class="cumulative-value">{{ formatWan(summary?.totalWater) }}</div>
              </div>
              <div class="cumulative-item">
                <div class="cumulative-label">累计产气(万m³)</div>
                <div class="cumulative-value">{{ formatWan(summary?.totalGas) }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-card>
        <template #header>
          <div class="card-header">
            <span>生产数据列表</span>
          </div>
        </template>
        <el-table
          :data="productionList"
          :row-class-name="rowClassName"
          border
          stripe
          style="width: 100%"
          v-loading="listLoading"
          @sort-change="handleSortChange"
        >
          <el-table-column prop="reportDate" label="日期" width="120" sortable="custom" />
          <el-table-column prop="wellName" label="井名" width="100" />
          <el-table-column prop="productionHours" label="生产时数(h)" width="120" sortable="custom" />
          <el-table-column prop="oilProduction" label="产油量(t)" width="110" sortable="custom" />
          <el-table-column prop="waterProduction" label="产水量(t)" width="110" sortable="custom" />
          <el-table-column prop="gasProduction" label="产气量(m³)" width="120" />
          <el-table-column prop="waterCut" label="含水率(%)" width="150" sortable="custom">
            <template #default="{ row }">
              <el-progress :percentage="Number(row.waterCut)" :stroke-width="12" :show-text="true" />
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="tubingPressure" label="油压(MPa)" width="110" />
          <el-table-column prop="casingPressure" label="套压(MPa)" width="110" />
          <el-table-column label="操作" width="170" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" link @click="openDetail(row)">明细</el-button>
              <el-button type="primary" size="small" link @click="openCorrect(row)">修正</el-button>
              <el-button type="danger" size="small" link @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="当前筛选条件下暂无生产数据" />
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
      </el-card>
    </template>

    <!-- 数据采集 / 修正 共用表单 -->
    <el-drawer v-model="formVisible" :title="formTitle" size="420px" :destroy-on-close="true">
      <el-form :model="dataForm" :rules="dataFormRules" ref="dataFormRef" label-width="110px">
        <el-form-item label="井" prop="wellId">
          <el-select v-model="dataForm.wellId" placeholder="请选择井" style="width: 100%" :disabled="formMode === 'correct'">
            <el-option v-for="well in wellList" :key="well.id" :label="well.wellName" :value="well.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期" prop="reportDate">
          <el-date-picker
            v-model="dataForm.reportDate"
            type="date"
            placeholder="请选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            :disabled="formMode === 'correct'"
          />
        </el-form-item>
        <el-form-item label="生产时数(h)" prop="productionHours">
          <el-input-number v-model="dataForm.productionHours" :min="0" :max="24" :precision="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="产油量(t)" prop="oilProduction">
          <el-input-number v-model="dataForm.oilProduction" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="产水量(t)" prop="waterProduction">
          <el-input-number v-model="dataForm.waterProduction" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="产气量(m³)" prop="gasProduction">
          <el-input-number v-model="dataForm.gasProduction" :min="0" :precision="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="含水率(%)">
          <el-tag type="info">{{ formWaterCut }}%</el-tag>
          <span class="form-tip">按 产水量 /（产油量 + 产水量）自动计算</span>
        </el-form-item>
        <el-form-item label="油压(MPa)" prop="tubingPressure">
          <el-input-number v-model="dataForm.tubingPressure" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="套压(MPa)" prop="casingPressure">
          <el-input-number v-model="dataForm.casingPressure" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitData">确定</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { ArrowLeft as ArrowLeftIcon } from '@element-plus/icons-vue'
import {
  getProductionWells,
  getProductionList,
  locateProduction,
  getProductionDaily,
  getProductionTrend,
  getProductionSummary,
  submitProductionData,
  correctProductionData,
  removeProductionData
} from '@/api/production'
import { buildProductionQuery } from '@/api/productionQuery'
import { calcWaterCut, type ProductionRow, type TrendPoint, type ProductionSummaryData, type Well } from '@/mock/productionDb'
import { defaultDateRange } from '@/utils/date'

// ---------------- 筛选条件（进入详情后仍保留在组件状态中） ----------------
const selectedWell = ref<number | undefined>(undefined)
const dateRange = ref<[Date, Date] | ''>(defaultDateRange(30))
const locateDate = ref('')
const wellList = ref<Well[]>([])
const chartType = ref('oil')
const filters = reactive({
  keyword: '',
  status: '',
  minWaterCut: undefined as number | undefined
})

// ---------------- 三处联动展示的数据 ----------------
const dailyData = ref<ProductionRow | null>(null)
const productionList = ref<ProductionRow[]>([])
const trendData = ref<TrendPoint[]>([])
const summary = ref<ProductionSummaryData | null>(null)

const cardLoading = ref(false)
const listLoading = ref(false)
const trendLoading = ref(false)
const summaryLoading = ref(false)

const pagination = reactive({ page: 1, size: 10, total: 0 })
const sorting = reactive({ sortField: 'reportDate', sortOrder: 'descending' as 'ascending' | 'descending' })
const highlightedRowId = ref<number | null>(null)

// ---------------- 明细详情（页内切换，返回时条件不丢） ----------------
const viewMode = ref<'list' | 'detail'>('list')
const detailRow = ref<ProductionRow | null>(null)

const openDetail = (row: ProductionRow) => {
  detailRow.value = row
  viewMode.value = 'detail'
}
const closeDetail = () => {
  viewMode.value = 'list'
  detailRow.value = null
  nextTick(() => renderChart())
}

// ---------------- 查询参数 ----------------
const baseQuery = () =>
  buildProductionQuery({
    wellId: selectedWell.value,
    dateRange: dateRange.value
  })

/** 清空所有展示内容，避免空结果/接口失败时残留上一组数据 */
const clearAllSections = () => {
  dailyData.value = null
  productionList.value = []
  pagination.total = 0
  trendData.value = []
  summary.value = null
  renderChart()
}

let panelsSeq = 0
let listSeq = 0

const loadAll = () => {
  loadPanels()
  loadList()
}

const loadPanels = async () => {
  if (selectedWell.value === undefined) return
  const seq = ++panelsSeq
  const query = {
    ...baseQuery(),
    keyword: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
    minWaterCut: filters.minWaterCut
  }

  // 指标卡
  cardLoading.value = true
  getProductionDaily(query)
    .then((res) => {
      if (seq === panelsSeq) dailyData.value = res.data
    })
    .catch(() => {
      if (seq === panelsSeq) dailyData.value = null
      ElMessage.error('生产指标加载失败，已清空旧指标')
    })
    .finally(() => {
      if (seq === panelsSeq) cardLoading.value = false
    })

  // 累计产量
  summaryLoading.value = true
  getProductionSummary(query)
    .then((res) => {
      if (seq === panelsSeq) summary.value = res.data
    })
    .catch(() => {
      if (seq === panelsSeq) summary.value = null
      ElMessage.error('累计产量加载失败，已清空旧汇总')
    })
    .finally(() => {
      if (seq === panelsSeq) summaryLoading.value = false
    })

  // 趋势图
  trendLoading.value = true
  getProductionTrend(query)
    .then((res) => {
      if (seq === panelsSeq) trendData.value = res.data
    })
    .catch(() => {
      if (seq === panelsSeq) trendData.value = []
      ElMessage.error('产量趋势加载失败，已清空旧趋势')
    })
    .finally(() => {
      if (seq === panelsSeq) trendLoading.value = false
    })
}

/** 列表（含排序/分页）单独刷新，分页变化时不重拉其他三处 */
const loadList = async () => {
  if (selectedWell.value === undefined) return
  const seq = ++listSeq
  listLoading.value = true
  try {
    const res = await getProductionList({
      ...baseQuery(),
      keyword: filters.keyword.trim() || undefined,
      status: filters.status || undefined,
      minWaterCut: filters.minWaterCut,
      sortField: sorting.sortField,
      sortOrder: sorting.sortOrder,
      page: pagination.page,
      size: pagination.size
    })
    if (seq !== listSeq) return
    productionList.value = res.data.rows
    pagination.total = res.data.total
  } catch {
    if (seq === listSeq) {
      productionList.value = []
      pagination.total = 0
      ElMessage.error('生产数据列表加载失败，已清空旧列表')
    }
  } finally {
    if (seq === listSeq) listLoading.value = false
  }
}

// ---------------- 条件变化：井、日期、过滤项变化后三处同时更新 ----------------
let reloadTimer: ReturnType<typeof setTimeout> | undefined
const scheduleReload = () => {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    pagination.page = 1
    loadAll()
  }, 250)
}

watch(selectedWell, scheduleReload)
watch(dateRange, scheduleReload)
watch(
  () => filters.status,
  () => scheduleReload()
)
watch(
  () => filters.minWaterCut,
  () => scheduleReload()
)
watch(
  () => filters.keyword,
  () => scheduleReload()
)

const handleQuery = () => {
  pagination.page = 1
  loadAll()
}

const handleReset = () => {
  filters.keyword = ''
  filters.status = ''
  filters.minWaterCut = undefined
  locateDate.value = ''
  highlightedRowId.value = null
  if (wellList.value.length > 0) selectedWell.value = wellList.value[0].id
  dateRange.value = defaultDateRange(30)
  pagination.page = 1
  loadAll()
}

// ---------------- 排序 / 分页 / 定位 ----------------
const handleSortChange = ({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) => {
  sorting.sortField = prop || 'reportDate'
  sorting.sortOrder = order || 'descending'
  pagination.page = 1
  loadList()
}

let suspendPageWatch = false
const handlePageChange = () => {
  if (suspendPageWatch) {
    suspendPageWatch = false
    return
  }
  highlightedRowId.value = null
  loadList()
}

const handleLocate = async () => {
  if (!locateDate.value) {
    ElMessage.warning('请先选择要定位的日期')
    return
  }
  // 使在途的列表分页请求失效，避免旧响应覆盖定位结果
  listSeq++
  listLoading.value = true
  try {
    const res = await locateProduction({
      ...baseQuery(),
      keyword: filters.keyword.trim() || undefined,
      status: filters.status || undefined,
      minWaterCut: filters.minWaterCut,
      sortField: sorting.sortField,
      sortOrder: sorting.sortOrder,
      date: locateDate.value,
      page: 1,
      size: pagination.size
    })
    const data = res.data
    if (!data.found) {
      productionList.value = []
      pagination.total = data.total
      ElMessage.warning(`当前筛选条件下未找到 ${locateDate.value} 的数据`)
      return
    }
    if (data.page !== pagination.page) {
      suspendPageWatch = true
      pagination.page = data.page
    }
    productionList.value = data.rows
    pagination.total = data.total
    highlightedRowId.value = data.rowId
    await nextTick()
    const el = document.querySelector('.production-container .el-table .locate-row')
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } catch {
    productionList.value = []
    pagination.total = 0
    ElMessage.error('定位失败，已清空旧列表')
  } finally {
    listLoading.value = false
  }
}

const rowClassName = ({ row }: { row: ProductionRow }) =>
  row.id === highlightedRowId.value ? 'locate-row' : ''

// ---------------- 数据采集 / 修正 ----------------
const formVisible = ref(false)
const formMode = ref<'create' | 'correct'>('create')
const submitting = ref(false)
const dataFormRef = ref<FormInstance>()
const dataForm = reactive({
  id: undefined as number | undefined,
  wellId: undefined as number | undefined,
  reportDate: '',
  productionHours: 24,
  oilProduction: 0,
  waterProduction: 0,
  gasProduction: 0,
  tubingPressure: 0,
  casingPressure: 0
})

const formTitle = computed(() => (formMode.value === 'create' ? '数据采集' : '修正生产数据'))
const formWaterCut = computed(() => calcWaterCut(Number(dataForm.oilProduction) || 0, Number(dataForm.waterProduction) || 0))

const dataFormRules = {
  wellId: [{ required: true, message: '请选择井', trigger: 'change' }],
  reportDate: [{ required: true, message: '请选择日期', trigger: 'change' }],
  productionHours: [{ required: true, message: '请输入生产时数', trigger: 'blur' }],
  oilProduction: [{ required: true, message: '请输入产油量', trigger: 'blur' }],
  waterProduction: [{ required: true, message: '请输入产水量', trigger: 'blur' }]
}

const resetForm = () => {
  Object.assign(dataForm, {
    id: undefined,
    wellId: selectedWell.value,
    reportDate: '',
    productionHours: 24,
    oilProduction: 0,
    waterProduction: 0,
    gasProduction: 0,
    tubingPressure: 0,
    casingPressure: 0
  })
}

const openCreate = () => {
  formMode.value = 'create'
  resetForm()
  formVisible.value = true
}

const openCorrect = (row: ProductionRow) => {
  formMode.value = 'correct'
  Object.assign(dataForm, {
    id: row.id,
    wellId: row.wellId,
    reportDate: row.reportDate,
    productionHours: row.productionHours,
    oilProduction: row.oilProduction,
    waterProduction: row.waterProduction,
    gasProduction: row.gasProduction,
    tubingPressure: row.tubingPressure,
    casingPressure: row.casingPressure
  })
  viewMode.value = 'list'
  formVisible.value = true
}

const handleSubmitData = () => {
  if (!dataFormRef.value) return
  dataFormRef.value.validate(async (valid) => {
    if (!valid) return
    if (!dataForm.wellId) {
      ElMessage.warning('请选择井')
      return
    }
    const payload = {
      id: dataForm.id,
      wellId: dataForm.wellId,
      reportDate: dataForm.reportDate,
      productionHours: Number(dataForm.productionHours),
      oilProduction: Number(dataForm.oilProduction),
      waterProduction: Number(dataForm.waterProduction),
      gasProduction: Number(dataForm.gasProduction),
      tubingPressure: Number(dataForm.tubingPressure),
      casingPressure: Number(dataForm.casingPressure)
    }
    submitting.value = true
    try {
      if (formMode.value === 'create') {
        await submitProductionData(payload)
        ElMessage.success('采集成功')
      } else {
        await correctProductionData(payload)
        ElMessage.success('修正已按替换方式保存，未重复累加产量')
      }
      formVisible.value = false
      // 修正/新增后三处与列表用同一时间口径重新汇总
      await loadAll()
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    } finally {
      submitting.value = false
    }
  })
}

const handleDelete = (row: ProductionRow) => {
  ElMessageBox.confirm(`确定删除 ${row.wellName} ${row.reportDate} 的生产数据吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      try {
        await removeProductionData(row.id)
        ElMessage.success('删除成功')
        if (productionList.value.length === 1 && pagination.page > 1) pagination.page -= 1
        await loadAll()
      } catch (e: any) {
        ElMessage.error(e?.message || '删除失败')
      }
    })
    .catch(() => {})
}

const handleImport = () => {
  ElMessage.info('演示环境暂未开放导入功能')
}
const handleExport = () => {
  ElMessage.success('已按当前井、日期筛选条件生成导出任务')
}

// ---------------- 趋势图 ----------------
const trendChart = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

const CHART_META = {
  oil: { name: '产油量(t)', color: '#3b82f6' },
  water: { name: '产水量(t)', color: '#22c55e' },
  waterCut: { name: '含水率(%)', color: '#f59e0b' }
} as const

const renderChart = () => {
  if (!chartInstance) return
  const meta = CHART_META[chartType.value as keyof typeof CHART_META]
  if (!trendData.value.length) {
    chartInstance.clear()
    chartInstance.setOption({
      title: {
        text: '暂无趋势数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 14, fontWeight: 'normal' }
      }
    })
    return
  }
  chartInstance.setOption(
    {
      title: { text: '' },
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trendData.value.map((p) => p.date.slice(5))
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: meta.name,
          type: 'line',
          smooth: true,
          areaStyle: { color: `${meta.color}1a` },
          itemStyle: { color: meta.color },
          data: trendData.value.map((p) =>
            chartType.value === 'oil'
              ? p.oilProduction
              : chartType.value === 'water'
                ? p.waterProduction
                : p.waterCut
          )
        }
      ]
    },
    true
  )
}

const handleResize = () => chartInstance?.resize()

watch(chartType, () => renderChart())
watch(trendData, () => renderChart(), { deep: false })

// ---------------- 工具方法 ----------------
const getStatusType = (status: string) => {
  const map: Record<string, string> = { 正常: 'success', 异常: 'warning', 停井: 'danger' }
  return map[status] || 'info'
}

const formatMetric = (value: number | null | undefined, unit = '') => {
  if (value === null || value === undefined) return '--'
  return `${value}${unit}`
}

/** 汇总页口径：吨换算为万吨，保留两位小数；无数据显示 -- */
const formatWan = (value?: number) => {
  if (value === null || value === undefined) return '--'
  return (value / 10000).toFixed(2)
}

onMounted(async () => {
  await nextTick()
  if (trendChart.value) {
    chartInstance = echarts.init(trendChart.value)
    renderChart()
    window.addEventListener('resize', handleResize)
  }
  try {
    const res = await getProductionWells()
    wellList.value = res.data
    if (wellList.value.length > 0) {
      selectedWell.value = wellList.value[0].id
      // watch(selectedWell) 会触发首次 loadAll
    } else {
      clearAllSections()
    }
  } catch {
    wellList.value = []
    clearAllSections()
    ElMessage.error('井位列表加载失败，已清空页面数据')
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
  chartInstance = null
  if (reloadTimer) clearTimeout(reloadTimer)
})
</script>

<style scoped lang="scss">
.production-container {
  width: 100%;
}

.filter-row {
  margin-top: 16px;
}

.locate-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.watercut-filter {
  display: flex;
  align-items: center;
  gap: 8px;

  .watercut-label {
    font-size: 13px;
    color: #64748b;
    white-space: nowrap;
  }
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

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.water-cut-danger {
  color: #ef4444;
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
  padding: 20px 0;
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
    font-size: 32px;
    font-weight: 600;
    color: #1e293b;
  }
}

.text-right {
  text-align: right;
}

.form-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #94a3b8;
}

:deep(.locate-row) {
  background-color: #fef3c7 !important;

  td {
    background-color: #fef3c7 !important;
  }
}
</style>
