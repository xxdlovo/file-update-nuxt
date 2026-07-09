<script setup lang="ts">
type AuditLogItem = {
  id: number
  userId: number | null
  action: string
  resourceType: string
  resourceId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  user: {
    id: number
    name: string
    email: string
  } | null
}

const ALL_FILTER_VALUE = '__all__'

const actionItems = [{
  label: '全部动作',
  value: ALL_FILTER_VALUE
}, {
  label: '登录',
  value: 'login'
}, {
  label: '应用',
  value: 'app'
}, {
  label: '应用版本',
  value: 'app_version'
}, {
  label: '升级文件',
  value: 'update_file'
}, {
  label: '普通文件项目',
  value: 'file_project'
}, {
  label: '普通文件版本',
  value: 'file_version'
}]

const resourceTypeItems = [{
  label: '全部资源',
  value: ALL_FILTER_VALUE
}, {
  label: '用户',
  value: 'user'
}, {
  label: '应用',
  value: 'app'
}, {
  label: '应用版本',
  value: 'app_version'
}, {
  label: '升级文件',
  value: 'update_file'
}, {
  label: '普通文件项目',
  value: 'file_project'
}, {
  label: '普通文件版本',
  value: 'file_version'
}]

const pageSizeItems = [{
  label: '10 条/页',
  value: 10
}, {
  label: '20 条/页',
  value: 20
}, {
  label: '50 条/页',
  value: 50
}, {
  label: '100 条/页',
  value: 100
}]

const search = ref('')
const actionGroup = ref(ALL_FILTER_VALUE)
const resourceType = ref(ALL_FILTER_VALUE)
const page = ref(1)
const pageSize = ref(20)
const detailOpen = ref(false)
const selectedLog = ref<AuditLogItem | null>(null)

const requestPath = computed(() => {
  const params = new URLSearchParams()
  const keyword = search.value.trim()

  if (keyword) {
    params.set('q', keyword)
  }

  if (actionGroup.value === 'login') {
    params.set('action', 'login')
  } else if (actionGroup.value !== ALL_FILTER_VALUE) {
    params.set('actionPrefix', actionGroup.value)
  }

  if (resourceType.value !== ALL_FILTER_VALUE) {
    params.set('resourceType', resourceType.value)
  }

  params.set('page', String(page.value))
  params.set('pageSize', String(pageSize.value))

  return `/api/audit-logs?${params.toString()}`
})

const { data, status, refresh } = useLazyFetch<{
  items: AuditLogItem[]
  total: number
  page: number
  pageSize: number
}>(() => requestPath.value, {
  watch: [requestPath]
})

const logs = computed(() => data.value?.items || [])
const total = computed(() => data.value?.total || 0)
const loading = computed(() => status.value === 'pending' || status.value === 'idle')
const hasFilters = computed(() => Boolean(
  search.value.trim()
  || actionGroup.value !== ALL_FILTER_VALUE
  || resourceType.value !== ALL_FILTER_VALUE
))

watch([search, actionGroup, resourceType, pageSize], () => {
  page.value = 1
})

function resetFilters() {
  search.value = ''
  actionGroup.value = ALL_FILTER_VALUE
  resourceType.value = ALL_FILTER_VALUE
  page.value = 1
}

function parseServerTime(value: string) {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    return new Date(normalized)
  }

  return new Date(`${normalized}Z`)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(parseServerTime(value))
}

function userLabel(log: AuditLogItem) {
  if (log.user) {
    return `${log.user.name} <${log.user.email}>`
  }

  if (log.userId) {
    return `用户 #${log.userId}`
  }

  return '系统'
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    login: '登录',
    'app.create': '创建应用',
    'app.update': '更新应用',
    'app.disable': '停用应用',
    'app_version.create': '创建应用版本',
    'app_version.publish': '发布应用版本',
    'app_version.revoke': '撤销应用版本',
    'app_version.rollback': '回滚应用版本',
    'app_version.delete': '删除应用版本',
    'update_file.upload': '上传升级文件',
    'update_file.delete': '删除升级文件',
    'file_project.create': '创建文件项目',
    'file_project.update': '更新文件项目',
    'file_project.disable': '停用文件项目',
    'file_version.create': '创建文件版本',
    'file_version.upload': '上传文件版本',
    'file_version.publish': '发布文件版本',
    'file_version.revoke': '撤销文件版本',
    'file_version.rollback': '回滚文件版本',
    'file_version.delete': '删除文件版本'
  }

  return labels[action] || action
}

function resourceTypeLabel(value: string) {
  const labels: Record<string, string> = {
    user: '用户',
    app: '应用',
    app_version: '应用版本',
    update_file: '升级文件',
    file_project: '普通文件项目',
    file_version: '普通文件版本'
  }

  return labels[value] || value
}

function actionColor(action: string) {
  if (action.includes('delete') || action.includes('disable')) {
    return 'error'
  }

  if (action.includes('publish') || action.includes('upload')) {
    return 'success'
  }

  if (action.includes('revoke') || action.includes('rollback')) {
    return 'warning'
  }

  return 'neutral'
}

function metadataText(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return '-'
  }

  return JSON.stringify(metadata, null, 2)
}

function openDetail(log: AuditLogItem) {
  selectedLog.value = log
  detailOpen.value = true
}
</script>

<template>
  <main>
    <section class="border-b border-muted px-6 py-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-sm text-muted">
            系统审计
          </p>
          <h1 class="mt-1 text-2xl font-semibold">
            日志查看
          </h1>
        </div>

        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          label="刷新"
          :loading="loading"
          @click="refresh"
        />
      </div>
    </section>

    <section class="space-y-4 px-6 py-6">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="搜索动作、资源或详情"
          />
          <USelect v-model="actionGroup" :items="actionItems" value-key="value" />
          <USelect v-model="resourceType" :items="resourceTypeItems" value-key="value" />
          <USelect v-model="pageSize" :items="pageSizeItems" value-key="value" />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-rotate-ccw"
            label="重置"
            :disabled="!hasFilters"
            @click="resetFilters"
          />
        </div>

        <p class="text-sm text-muted">
          共 {{ total }} 条
        </p>
      </div>

      <UCard>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-muted text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">时间</th>
                <th class="px-4 py-3 font-medium">操作人</th>
                <th class="px-4 py-3 font-medium">动作</th>
                <th class="px-4 py-3 font-medium">资源</th>
                <th class="px-4 py-3 font-medium">详情</th>
                <th class="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-4 py-8 text-center text-muted" colspan="6">
                  正在加载日志
                </td>
              </tr>
              <tr v-else-if="logs.length === 0">
                <td class="px-4 py-8 text-center text-muted" colspan="6">
                  暂无日志
                </td>
              </tr>
              <tr
                v-for="log in logs"
                v-else
                :key="log.id"
                class="border-b border-muted last:border-b-0"
              >
                <td class="whitespace-nowrap px-4 py-3 text-muted">
                  {{ formatTime(log.createdAt) }}
                </td>
                <td class="px-4 py-3">
                  {{ userLabel(log) }}
                </td>
                <td class="px-4 py-3">
                  <UBadge :color="actionColor(log.action)" variant="subtle" :label="actionLabel(log.action)" />
                </td>
                <td class="px-4 py-3">
                  <p>{{ resourceTypeLabel(log.resourceType) }}</p>
                  <p class="text-xs text-muted">
                    {{ log.resourceId || '-' }}
                  </p>
                </td>
                <td class="max-w-sm px-4 py-3">
                  <code class="line-clamp-2 block whitespace-pre-wrap break-all text-xs text-muted">
                    {{ metadataText(log.metadata) }}
                  </code>
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      aria-label="查看详情"
                      @click="openDetail(log)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UPagination
              v-model:page="page"
              :items-per-page="pageSize"
              :total="total"
            />
          </div>
        </template>
      </UCard>
    </section>

    <UModal
      v-model:open="detailOpen"
      title="日志详情"
      :description="selectedLog ? `#${selectedLog.id} ${actionLabel(selectedLog.action)}` : undefined"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div v-if="selectedLog" class="space-y-4 text-sm">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <p class="text-muted">时间</p>
              <p class="mt-1">{{ formatTime(selectedLog.createdAt) }}</p>
            </div>
            <div>
              <p class="text-muted">操作人</p>
              <p class="mt-1">{{ userLabel(selectedLog) }}</p>
            </div>
            <div>
              <p class="text-muted">动作</p>
              <p class="mt-1">{{ selectedLog.action }}</p>
            </div>
            <div>
              <p class="text-muted">资源</p>
              <p class="mt-1">{{ selectedLog.resourceType }} / {{ selectedLog.resourceId || '-' }}</p>
            </div>
          </div>

          <div>
            <p class="text-muted">Metadata</p>
            <pre class="mt-2 max-h-96 overflow-auto rounded bg-elevated p-3 text-xs">{{ metadataText(selectedLog.metadata) }}</pre>
          </div>
        </div>
      </template>

      <template #footer="{ close }">
        <UButton
          color="neutral"
          variant="outline"
          label="关闭"
          @click="close"
        />
      </template>
    </UModal>
  </main>
</template>
