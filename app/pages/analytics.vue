<script setup lang="ts">
type AnalyticsTarget = {
  id: number
  name: string
  slug: string
  enabled: boolean
  defaultChannel: string
}

type AnalyticsSummary = {
  type: 'app' | 'file'
  target: {
    id: number
    name: string
    slug: string
  }
  rangeDays: number
  summary: {
    totalEvents: number
    startupEvents: number
    downloadEvents: number
    errorEvents: number
    uniqueClients: number
    totalBytes: number
    avgStartupMs: number
    lastSevenEvents: number
  }
  daily: Array<{
    date: string
    events: number
    startups: number
    downloads: number
  }>
  eventTypes: Array<{ eventType: string, total: number }>
  versions: Array<{ versionId: number | null, version: string, channel: string, environment?: string, total: number }>
  platforms: Array<{ platform: string, arch: string, total: number }>
  clients: Array<{
    clientId: string
    clientName: string
    clientVersion: string
    version: string
    platform: string
    arch: string
    total: number
    startups: number
    downloads: number
    errors: number
    totalBytes: number
    lastSeenAt: string
    lastEventType: string | null
    userAgent: string | null
    ipAddress: string | null
    recentEvents: Array<{
      id: number
      eventType: string
      version: string
      source: string
      metadata: unknown
      userAgent: string | null
      ipAddress: string | null
      durationMs: number | null
      startupDurationMs: number | null
      bytes: number | null
      createdAt: string
    }>
  }>
  recent: Array<{
    id: number
    eventType: string
    versionId: number | null
    version: string
    clientId: string | null
    clientName: string | null
    platform: string | null
    arch: string | null
    durationMs: number | null
    startupDurationMs: number | null
    bytes: number | null
    metadata: unknown
    source: string
    userAgent: string | null
    ipAddress: string | null
    createdAt: string
  }>
}

const toast = useToast()
const mode = ref<'app' | 'file'>('app')
const selectedAppId = ref<number | null>(null)
const selectedFileId = ref<number | null>(null)
const days = ref(14)
const loading = ref(false)
const summary = ref<AnalyticsSummary | null>(null)
const detailOpen = ref(false)
const selectedClient = ref<AnalyticsSummary['clients'][number] | null>(null)

const modeItems = [{
  label: 'Electron 应用',
  value: 'app'
}, {
  label: '普通文件',
  value: 'file'
}]
const dayItems = [{
  label: '近 7 天',
  value: 7
}, {
  label: '近 14 天',
  value: 14
}, {
  label: '近 30 天',
  value: 30
}, {
  label: '近 90 天',
  value: 90
}]

const { data: targets } = useLazyFetch<{ apps: AnalyticsTarget[], files: AnalyticsTarget[] }>('/api/analytics/targets')

const appItems = computed(() => (targets.value?.apps || []).map(item => ({
  label: `${item.name} / ${item.slug}`,
  value: item.id
})))
const fileItems = computed(() => (targets.value?.files || []).map(item => ({
  label: `${item.name} / ${item.slug}`,
  value: item.id
})))
const selectedId = computed(() => mode.value === 'app' ? selectedAppId.value : selectedFileId.value)
const maxDailyEvents = computed(() => Math.max(...(summary.value?.daily.map(item => Math.max(item.events, item.startups, item.downloads)) || [0]), 1))
const totalEventTypes = computed(() => Math.max(...(summary.value?.eventTypes.map(item => item.total) || [0]), 1))
const maxVersionEvents = computed(() => Math.max(...(summary.value?.versions.map(item => item.total) || [0]), 1))
const maxPlatformEvents = computed(() => Math.max(...(summary.value?.platforms.map(item => item.total) || [0]), 1))
const maxClientEvents = computed(() => Math.max(...(summary.value?.clients.map(item => item.total) || [0]), 1))

watch(targets, (value) => {
  if (!selectedAppId.value && value?.apps[0]) {
    selectedAppId.value = value.apps[0].id
  }

  if (!selectedFileId.value && value?.files[0]) {
    selectedFileId.value = value.files[0].id
  }
}, { immediate: true })

watch([mode, selectedAppId, selectedFileId, days], () => {
  loadSummary()
})

async function loadSummary() {
  if (!selectedId.value) {
    summary.value = null
    return
  }

  loading.value = true

  try {
    summary.value = await $fetch('/api/analytics/summary', {
      query: {
        type: mode.value,
        id: selectedId.value,
        days: days.value
      }
    })
  } catch (error) {
    toast.add({
      title: '加载统计失败',
      description: error instanceof Error ? error.message : '请稍后重试',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function formatBytes(value: number | null) {
  const size = Number(value || 0)

  if (!size) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)

  return `${(size / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatTime(value: string) {
  return new Date(value).toLocaleString()
}

function formatShortDate(value: string) {
  return value.slice(5)
}

function eventTypeLabel(value: string) {
  return {
    startup: '启动',
    launch: '启动',
    start: '启动',
    download: '下载',
    file_download: '文件下载',
    update_download: '更新下载',
    install: '安装',
    error: '错误',
    crash: '崩溃',
    exception: '异常'
  }[value] || value
}

function metadataText(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

function eventMetricText(event: AnalyticsSummary['clients'][number]['recentEvents'][number]) {
  if (event.startupDurationMs) {
    return `${event.startupDurationMs}ms`
  }

  if (event.durationMs) {
    return `${event.durationMs}ms`
  }

  return formatBytes(event.bytes)
}

function openClientDetail(client: AnalyticsSummary['clients'][number]) {
  selectedClient.value = client
  detailOpen.value = true
}
</script>

<template>
  <main>
    <section class="border-b border-muted px-6 py-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-sm text-muted">
            Analytics
          </p>
          <h1 class="mt-1 text-2xl font-semibold">
            数据统计
          </h1>
        </div>

        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          label="刷新"
          :loading="loading"
          @click="loadSummary"
        />
      </div>
    </section>

    <section class="space-y-6 px-6 py-6">
      <div class="grid gap-3 lg:grid-cols-[12rem_minmax(16rem,1fr)_10rem]">
        <USelect v-model="mode" :items="modeItems" value-key="value" />
        <USelect
          v-if="mode === 'app'"
          v-model="selectedAppId"
          :items="appItems"
          value-key="value"
          placeholder="选择 Electron 应用"
        />
        <USelect
          v-else
          v-model="selectedFileId"
          :items="fileItems"
          value-key="value"
          placeholder="选择普通文件"
        />
        <USelect v-model="days" :items="dayItems" value-key="value" />
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <UCard>
          <p class="text-sm text-muted">事件总数</p>
          <p class="mt-2 text-3xl font-semibold">{{ summary?.summary.totalEvents || 0 }}</p>
        </UCard>
        <UCard>
          <p class="text-sm text-muted">启动事件</p>
          <p class="mt-2 text-3xl font-semibold">{{ summary?.summary.startupEvents || 0 }}</p>
        </UCard>
        <UCard>
          <p class="text-sm text-muted">下载事件</p>
          <p class="mt-2 text-3xl font-semibold">{{ summary?.summary.downloadEvents || 0 }}</p>
        </UCard>
        <UCard>
          <p class="text-sm text-muted">错误事件</p>
          <p class="mt-2 text-3xl font-semibold">{{ summary?.summary.errorEvents || 0 }}</p>
        </UCard>
        <UCard>
          <p class="text-sm text-muted">客户端</p>
          <p class="mt-2 text-3xl font-semibold">{{ summary?.summary.uniqueClients || 0 }}</p>
        </UCard>
        <UCard>
          <p class="text-sm text-muted">平均启动</p>
          <p class="mt-2 text-3xl font-semibold">{{ summary?.summary.avgStartupMs || 0 }}ms</p>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <div>
            <h2 class="text-base font-semibold">事件趋势</h2>
            <p class="mt-1 text-sm text-muted">深色为事件总数，绿色为启动，浅色为下载。</p>
          </div>
        </template>

        <div class="grid grid-cols-7 gap-2 md:grid-cols-[repeat(14,minmax(0,1fr))] xl:grid-cols-[repeat(30,minmax(0,1fr))]">
          <div
            v-for="day in summary?.daily || []"
            :key="day.date"
            class="flex min-h-28 flex-col justify-end gap-2 rounded border border-muted px-2 py-2"
          >
            <div class="flex h-16 items-end gap-1">
              <div class="w-1/3 rounded bg-primary" :style="{ height: `${Math.max((day.events / maxDailyEvents) * 100, day.events ? 8 : 2)}%` }" />
              <div class="w-1/3 rounded bg-green-500" :style="{ height: `${Math.max((day.startups / maxDailyEvents) * 100, day.startups ? 8 : 2)}%` }" />
              <div class="w-1/3 rounded bg-primary/35" :style="{ height: `${Math.max((day.downloads / maxDailyEvents) * 100, day.downloads ? 8 : 2)}%` }" />
            </div>
            <div class="text-center">
              <p class="text-xs font-medium">{{ day.events }}</p>
              <p class="text-[11px] text-muted">{{ formatShortDate(day.date) }}</p>
            </div>
          </div>
        </div>
      </UCard>

      <div class="grid gap-6 xl:grid-cols-2">
        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">事件类型</h2>
          </template>

          <div class="space-y-3">
            <div v-for="item in summary?.eventTypes || []" :key="item.eventType">
              <div class="mb-1 flex items-center justify-between text-sm">
                <span>{{ eventTypeLabel(item.eventType) }}</span>
                <span class="font-medium">{{ item.total }}</span>
              </div>
              <div class="h-2 overflow-hidden rounded bg-elevated">
                <div class="h-full rounded bg-primary" :style="{ width: `${(item.total / totalEventTypes) * 100}%` }" />
              </div>
            </div>
            <p v-if="!summary?.eventTypes.length" class="py-8 text-center text-sm text-muted">暂无事件</p>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">平台分布</h2>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-muted text-muted">
                <tr>
                  <th class="px-3 py-2 font-medium">平台</th>
                  <th class="px-3 py-2 font-medium">架构</th>
                  <th class="px-3 py-2 font-medium">占比</th>
                  <th class="px-3 py-2 text-right font-medium">事件</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!summary?.platforms.length">
                  <td class="px-3 py-6 text-center text-muted" colspan="4">暂无平台数据</td>
                </tr>
                <tr v-for="item in summary?.platforms || []" :key="`${item.platform}:${item.arch}`" class="border-b border-muted last:border-b-0">
                  <td class="px-3 py-2">{{ item.platform }}</td>
                  <td class="px-3 py-2">{{ item.arch }}</td>
                  <td class="px-3 py-2">
                    <div class="h-2 overflow-hidden rounded bg-elevated">
                      <div class="h-full rounded bg-primary" :style="{ width: `${(item.total / maxPlatformEvents) * 100}%` }" />
                    </div>
                  </td>
                  <td class="px-3 py-2 text-right">{{ item.total }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>

      <div class="grid gap-6 xl:grid-cols-2">
        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">版本排行</h2>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-muted text-muted">
                <tr>
                  <th class="px-3 py-2 font-medium">版本</th>
                  <th class="px-3 py-2 font-medium">目标</th>
                  <th class="px-3 py-2 font-medium">趋势</th>
                  <th class="px-3 py-2 text-right font-medium">事件</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!summary?.versions.length">
                  <td class="px-3 py-6 text-center text-muted" colspan="4">暂无版本数据</td>
                </tr>
                <tr v-for="item in summary?.versions || []" :key="`${item.versionId}:${item.channel}:${item.environment || ''}`" class="border-b border-muted last:border-b-0">
                  <td class="px-3 py-2 font-medium">{{ item.version }}</td>
                  <td class="px-3 py-2">{{ item.environment ? `${item.channel} / ${item.environment}` : item.channel }}</td>
                  <td class="px-3 py-2">
                    <div class="h-2 overflow-hidden rounded bg-elevated">
                      <div class="h-full rounded bg-primary" :style="{ width: `${(item.total / maxVersionEvents) * 100}%` }" />
                    </div>
                  </td>
                  <td class="px-3 py-2 text-right">{{ item.total }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">活跃客户端</h2>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-muted text-muted">
                <tr>
                  <th class="px-3 py-2 font-medium">客户端</th>
                  <th class="px-3 py-2 font-medium">版本/平台</th>
                  <th class="px-3 py-2 font-medium">事件分布</th>
                  <th class="px-3 py-2 text-right font-medium">最后活跃</th>
                  <th class="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!summary?.clients.length">
                  <td class="px-3 py-6 text-center text-muted" colspan="5">暂无客户端数据</td>
                </tr>
                <tr v-for="item in summary?.clients || []" :key="`${item.clientId}:${item.clientVersion}`" class="border-b border-muted last:border-b-0">
                  <td class="px-3 py-2">
                    <p class="font-medium">{{ item.clientName }}</p>
                    <p class="text-xs text-muted">{{ item.clientId }}</p>
                  </td>
                  <td class="px-3 py-2">
                    <p>{{ item.version }} / {{ item.clientVersion }}</p>
                    <p class="text-xs text-muted">{{ item.platform }} / {{ item.arch }}</p>
                  </td>
                  <td class="px-3 py-2">
                    <div class="mb-1 flex items-center justify-between text-xs text-muted">
                      <span>启动 {{ item.startups }} / 下载 {{ item.downloads }} / 错误 {{ item.errors }}</span>
                      <span>{{ item.total }}</span>
                    </div>
                    <div class="h-2 overflow-hidden rounded bg-elevated">
                      <div class="h-full rounded bg-primary" :style="{ width: `${(item.total / maxClientEvents) * 100}%` }" />
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-2 text-right text-muted">{{ formatTime(item.lastSeenAt) }}</td>
                  <td class="px-3 py-2 text-right">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-eye"
                      label="详情"
                      @click="openClientDetail(item)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <h2 class="text-base font-semibold">最近事件</h2>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-muted text-muted">
              <tr>
                <th class="px-3 py-2 font-medium">时间</th>
                <th class="px-3 py-2 font-medium">事件</th>
                <th class="px-3 py-2 font-medium">版本</th>
                <th class="px-3 py-2 font-medium">客户端</th>
                <th class="px-3 py-2 font-medium">平台</th>
                <th class="px-3 py-2 text-right font-medium">数据</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!summary?.recent.length">
                <td class="px-3 py-8 text-center text-muted" colspan="6">暂无事件记录</td>
              </tr>
              <tr v-for="item in summary?.recent || []" :key="item.id" class="border-b border-muted last:border-b-0">
                <td class="whitespace-nowrap px-3 py-2">{{ formatTime(item.createdAt) }}</td>
                <td class="px-3 py-2">
                  <UBadge color="neutral" variant="subtle" :label="eventTypeLabel(item.eventType)" />
                </td>
                <td class="px-3 py-2">{{ item.version }}</td>
                <td class="px-3 py-2">
                  <p>{{ item.clientName || '-' }}</p>
                  <p class="text-xs text-muted">{{ item.clientId || '-' }}</p>
                </td>
                <td class="px-3 py-2">{{ item.platform || '-' }} / {{ item.arch || '-' }}</td>
                <td class="px-3 py-2 text-right">
                  <p v-if="item.startupDurationMs">{{ item.startupDurationMs }}ms</p>
                  <p v-else-if="item.durationMs">{{ item.durationMs }}ms</p>
                  <p v-else>{{ formatBytes(item.bytes) }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </section>

    <UModal
      v-model:open="detailOpen"
      title="客户端详情"
      :description="selectedClient ? selectedClient.clientId : undefined"
      :ui="{ content: 'w-[95vw] max-w-5xl', footer: 'justify-end' }"
    >
      <template #body>
        <div v-if="selectedClient" class="space-y-5 text-sm">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <p class="text-muted">客户端</p>
              <p class="mt-1 font-medium">{{ selectedClient.clientName }}</p>
              <p class="text-xs text-muted">{{ selectedClient.clientId }}</p>
            </div>
            <div>
              <p class="text-muted">版本 / 平台</p>
              <p class="mt-1">{{ selectedClient.version }} / {{ selectedClient.clientVersion }}</p>
              <p class="text-xs text-muted">{{ selectedClient.platform }} / {{ selectedClient.arch }}</p>
            </div>
            <div>
              <p class="text-muted">真实 IP</p>
              <p class="mt-1">{{ selectedClient.ipAddress || '-' }}</p>
            </div>
            <div>
              <p class="text-muted">最后活跃</p>
              <p class="mt-1">{{ formatTime(selectedClient.lastSeenAt) }}</p>
            </div>
            <div class="sm:col-span-2">
              <p class="text-muted">User-Agent</p>
              <p class="mt-1 break-all">{{ selectedClient.userAgent || '-' }}</p>
            </div>
          </div>

          <div>
            <h3 class="font-medium">最近上报事件</h3>
            <div class="mt-3 space-y-3">
              <div
                v-if="!selectedClient.recentEvents.length"
                class="rounded border border-muted px-4 py-6 text-center text-muted"
              >
                暂无事件明细
              </div>
              <div
                v-for="event in selectedClient.recentEvents"
                :key="event.id"
                class="rounded border border-muted p-3"
              >
                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <UBadge color="neutral" variant="subtle" :label="eventTypeLabel(event.eventType)" />
                      <span class="text-xs text-muted">{{ event.version }} / {{ event.source }}</span>
                    </div>
                    <p class="mt-1 text-xs text-muted">
                      {{ formatTime(event.createdAt) }} / {{ event.ipAddress || '-' }}
                    </p>
                  </div>
                  <span class="text-sm text-muted">{{ eventMetricText(event) }}</span>
                </div>

                <div class="mt-3">
                  <p class="text-muted">Metadata</p>
                  <pre class="mt-2 max-h-64 overflow-auto rounded bg-elevated p-3 text-xs">{{ metadataText(event.metadata) }}</pre>
                </div>

                <p class="mt-3 break-all text-xs text-muted">
                  {{ event.userAgent || '-' }}
                </p>
              </div>
            </div>
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
