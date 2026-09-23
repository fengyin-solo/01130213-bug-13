<template>
  <div class="production-detail">
    <el-page-header @back="backToList" class="mb-20">
      <template #content>
        <span class="page-title">生产明细详情</span>
      </template>
    </el-page-header>

    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="error"
      show-icon
      :closable="false"
      class="mb-20"
    >
      <el-button type="primary" size="small" @click="loadDetail">重试</el-button>
    </el-alert>

    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>{{ record?.wellName }} · {{ record?.reportDate }}</span>
          <el-tag v-if="record" :type="record.status === '异常' ? 'danger' : 'success'">
            {{ record.status }}
          </el-tag>
        </div>
      </template>

      <el-descriptions v-if="record" :column="3" border>
        <el-descriptions-item label="井名">{{ record.wellName }}</el-descriptions-item>
        <el-descriptions-item label="日期">{{ record.reportDate }}</el-descriptions-item>
        <el-descriptions-item label="最近修正时间">{{ record.updateTime }}</el-descriptions-item>
        <el-descriptions-item label="生产时数(h)">{{ record.productionHours }}</el-descriptions-item>
        <el-descriptions-item label="产油量(t)">{{ record.oilProduction }}</el-descriptions-item>
        <el-descriptions-item label="产水量(t)">{{ record.waterProduction }}</el-descriptions-item>
        <el-descriptions-item label="产气量(m³)">{{ record.gasProduction }}</el-descriptions-item>
        <el-descriptions-item label="含水率(%)">
          <span class="water-cut">{{ record.waterCut }}%</span>
          <span class="calc-tip">= 水/(油+水)，与列表、累计面板同一公式</span>
        </el-descriptions-item>
        <el-descriptions-item label="油压(MPa)">{{ record.tubingPressure }}</el-descriptions-item>
        <el-descriptions-item label="套压(MPa)">{{ record.casingPressure }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else-if="!loading && !errorMsg" description="未找到该明细记录" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProductionDetail } from '@/api/production'
import { ProductionRecord } from '@/utils/production'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const errorMsg = ref('')
const record = ref<ProductionRecord | null>(null)

async function loadDetail() {
  const wellId = Number(route.query.wellId)
  const reportDate = String(route.query.reportDate || '')
  if (!wellId || !reportDate) {
    errorMsg.value = '缺少井或日期参数'
    record.value = null
    return
  }
  loading.value = true
  errorMsg.value = ''
  record.value = null
  try {
    record.value = await getProductionDetail(wellId, reportDate)
  } catch (e: any) {
    errorMsg.value = e?.message || '明细加载失败'
  } finally {
    loading.value = false
  }
}

/** 返回列表时保留原有的井、日期、状态等筛选条件（由路由 query 透传） */
function backToList() {
  const query: Record<string, string> = {}
  if (route.query.fWellId) query.fWellId = String(route.query.fWellId)
  if (route.query.fStart) query.fStart = String(route.query.fStart)
  if (route.query.fEnd) query.fEnd = String(route.query.fEnd)
  if (route.query.fStatus) query.fStatus = String(route.query.fStatus)
  if (route.query.fMockError) query.fMockError = String(route.query.fMockError)
  router.push({ path: '/production', query })
}

onMounted(loadDetail)
</script>

<style scoped lang="scss">
.page-title {
  font-weight: 600;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.water-cut {
  font-weight: 600;
  color: #d97706;
}

.calc-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #94a3b8;
}

.mb-20 {
  margin-bottom: 20px;
}
</style>
