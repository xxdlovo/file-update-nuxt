<script setup lang="ts">
type AppDetail = {
  id: number
  name: string
  slug: string
  bundleId: string
  defaultChannel: string
  enabled: boolean
  description: string | null
}

type AppVersion = {
  id: number
  appId: number
  version: string
  buildNumber: string | null
  channel: string
  status: string
  forceUpdate: boolean
  releaseNotes: string | null
  publishedAt: string | null
  updatedAt: string
}

type VersionFile = {
  id: number
  objectKey: string
}

type AppDownloadStats = {
  rangeDays: number
  summary: {
    totalChecks: number
    updateAvailableChecks: number
    downloadLinksIssued: number
    uniqueCheckers: number
    lastSevenChecks: number
  }
  daily: Array<{
    date: string
    checks: number
    downloadLinksIssued: number
  }>
  versions: Array<{
    versionId: number | null
    version: string
    channel: string
    checks: number
    downloadLinksIssued: number
  }>
  sources: Array<{
    source: string
    checks: number
    downloadLinksIssued: number
  }>
  recent: Array<{
    id: number
    versionId: number | null
    version: string
    channel: string
    platform: string
    arch: string
    currentVersion: string | null
    updateAvailable: boolean
    filesIssued: number
    source: string
    referer: string | null
    createdAt: string
  }>
}

const route = useRoute()
const toast = useToast()
const requestUrl = useRequestURL()
const appId = computed(() => String(route.params.id))
const creatingVersion = ref(false)
const versionModalOpen = ref(false)
const deleteVersionOpen = ref(false)
const deletingVersion = ref(false)
const versionError = ref('')
const pendingDeleteVersion = ref<AppVersion | null>(null)
const deleteVersionObjects = ref(false)
const pendingDeleteObjectKeys = ref<string[]>([])
const endpointForm = reactive({
  channel: 'latest',
  platform: 'win32',
  arch: 'x64'
})

const { data: app, refresh } = useLazyFetch<AppDetail>(() => `/api/apps/${appId.value}`)
const { data: versionsData, refresh: refreshVersions } = useLazyFetch<{ items: AppVersion[], total: number }>(
  () => `/api/apps/${appId.value}/versions`
)
const { data: downloadStats, status: downloadStatsStatus, refresh: refreshDownloadStats } = useLazyFetch<AppDownloadStats>(
  () => `/api/apps/${appId.value}/download-stats`,
  { query: { days: 14 } }
)

const versionForm = reactive({
  version: '',
  buildNumber: '',
  channel: '',
  forceUpdate: false,
  releaseNotes: ''
})

const versions = computed(() => versionsData.value?.items || [])
const downloadingStats = computed(() => downloadStatsStatus.value === 'pending' || downloadStatsStatus.value === 'idle')
const maxDailyStats = computed(() => Math.max(...(downloadStats.value?.daily.map(item => Math.max(item.checks, item.downloadLinksIssued)) || [0]), 1))
const channelItems = computed(() => {
  const channels = new Set<string>()

  if (app.value?.defaultChannel) {
    channels.add(app.value.defaultChannel)
  }

  for (const version of versions.value) {
    channels.add(version.channel)
  }

  channels.add(endpointForm.channel)

  return Array.from(channels).filter(Boolean)
})
const platformItems = ['win32', 'darwin', 'linux']
const archItems = ['x64', 'arm64']
const origin = computed(() => {
  if (import.meta.client) {
    return window.location.origin
  }

  return requestUrl.origin
})
const updaterMetadataFile = computed(() => {
  if (endpointForm.platform === 'darwin') {
    return 'latest-mac.yml'
  }

  if (endpointForm.platform === 'linux') {
    return 'latest-linux.yml'
  }

  return 'latest.yml'
})
const checkUpdateUrl = computed(() => {
  if (!app.value?.slug || !origin.value) {
    return ''
  }

  const url = new URL(`/api/public/apps/${encodeURIComponent(app.value.slug)}/check-update`, origin.value)

  url.searchParams.set('channel', endpointForm.channel)
  url.searchParams.set('platform', endpointForm.platform)
  url.searchParams.set('arch', endpointForm.arch)

  return url.toString()
})
const metadataUrl = computed(() => {
  if (!app.value?.slug || !origin.value) {
    return ''
  }

  const path = [
    '/updates',
    encodeURIComponent(app.value.slug),
    encodeURIComponent(endpointForm.platform),
    encodeURIComponent(endpointForm.channel),
    updaterMetadataFile.value
  ].join('/')
  const url = new URL(path, origin.value)

  url.searchParams.set('arch', endpointForm.arch)

  return url.toString()
})

watch(app, (value) => {
  if (!value) {
    return
  }

  versionForm.channel = value.defaultChannel
  endpointForm.channel = value.defaultChannel
}, { immediate: true })

function resetVersionForm() {
  versionForm.version = ''
  versionForm.buildNumber = ''
  versionForm.channel = app.value?.defaultChannel || 'latest'
  versionForm.forceUpdate = false
  versionForm.releaseNotes = ''
  versionError.value = ''
}

function openVersionModal() {
  resetVersionForm()
  versionModalOpen.value = true
}

function statusLabel(status: string) {
  return {
    draft: '草稿',
    published: '已发布',
    revoked: '已撤回'
  }[status] || status
}

function statusColor(status: string) {
  if (status === 'published') {
    return 'success'
  }

  if (status === 'revoked') {
    return 'warning'
  }

  return 'neutral'
}

function sourceLabel(source: string) {
  return {
    api: '检查接口',
    'electron-updater': 'electron-updater'
  }[source] || source
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString()
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: '2-digit',
    day: '2-digit'
  })
}

async function refreshPage() {
  await Promise.all([
    refresh(),
    refreshVersions(),
    refreshDownloadStats()
  ])
  toast.add({
    title: '页面已刷新',
    color: 'success',
    icon: 'i-lucide-refresh-cw'
  })
}

async function createVersion() {
  versionError.value = ''
  creatingVersion.value = true

  try {
    const created = await $fetch<AppVersion>(`/api/apps/${appId.value}/versions`, {
      method: 'POST',
      body: versionForm
    })
    toast.add({
      title: '版本已创建',
      color: 'success'
    })
    versionModalOpen.value = false
    resetVersionForm()
    await refreshVersions()
    await navigateTo(`/versions/${created.id}`)
  } catch (error) {
    versionError.value = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : '创建版本失败'
  } finally {
    creatingVersion.value = false
  }
}

async function openDeleteVersion(version: AppVersion) {
  pendingDeleteVersion.value = version
  deleteVersionObjects.value = false
  pendingDeleteObjectKeys.value = []
  deleteVersionOpen.value = true

  const result = await $fetch<{ items: VersionFile[], total: number }>(`/api/versions/${version.id}/files`)
  pendingDeleteObjectKeys.value = result.items.map(file => file.objectKey).filter(Boolean)
}

async function deleteVersion() {
  if (!pendingDeleteVersion.value) {
    return
  }

  deletingVersion.value = true

  try {
    await $fetch(`/api/versions/${pendingDeleteVersion.value.id}`, {
      method: 'DELETE',
      body: {
        deleteObjects: deleteVersionObjects.value,
        confirmObjectKeys: deleteVersionObjects.value ? pendingDeleteObjectKeys.value : []
      }
    })
    toast.add({
      title: '版本已删除',
      color: 'success'
    })
    deleteVersionOpen.value = false
    pendingDeleteVersion.value = null
    deleteVersionObjects.value = false
    pendingDeleteObjectKeys.value = []
    await refreshVersions()
  } finally {
    deletingVersion.value = false
  }
}

async function copyText(value: string, label: string) {
  if (!value) {
    return
  }

  await navigator.clipboard.writeText(value)
  toast.add({
    title: `${label}已复制`,
    color: 'success',
    icon: 'i-lucide-copy-check'
  })
}
</script>

<template>
  <main>
    <section class="border-b border-muted px-6 py-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <UButton
            color="neutral"
            variant="link"
            icon="i-lucide-arrow-left"
            to="/apps"
            label="返回应用列表"
            class="-ml-3 mb-1"
          />
          <h1 class="text-2xl font-semibold">
            {{ app?.name || '应用详情' }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ app?.bundleId }}
          </p>
        </div>

        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          label="刷新"
          @click="refreshPage"
        />
      </div>
    </section>

    <section class="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-6">
        <UCard>
          <template #header>
            <div>
              <h2 class="text-base font-semibold">
                基本信息
              </h2>
              <p class="mt-1 text-sm text-muted">
                这些信息用于后台识别应用和生成更新接口路径。
              </p>
            </div>
          </template>

          <div class="grid gap-4 text-sm lg:grid-cols-2">
            <div>
              <p class="text-muted">
                应用名称
              </p>
              <p class="mt-1 font-medium">
                {{ app?.name || '-' }}
              </p>
            </div>

            <div>
              <p class="text-muted">
                Slug
              </p>
              <code class="mt-1 block break-all rounded bg-elevated px-2 py-1 text-xs">
                {{ app?.slug || '-' }}
              </code>
            </div>

            <div>
              <p class="text-muted">
                Bundle ID
              </p>
              <p class="mt-1">
                {{ app?.bundleId || '-' }}
              </p>
            </div>

            <div>
              <p class="text-muted">
                默认通道
              </p>
              <UBadge class="mt-1" color="neutral" variant="subtle" :label="app?.defaultChannel || '-'" />
            </div>

            <div class="lg:col-span-2">
              <p class="text-muted">
                描述
              </p>
              <p class="mt-1 whitespace-pre-wrap">
                {{ app?.description || '-' }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="text-base font-semibold">
                  版本列表
                </h2>
                <p class="mt-1 text-sm text-muted">
                  管理该应用的 Electron 版本草稿和发布记录。
                </p>
              </div>

              <UButton
                icon="i-lucide-plus"
                label="创建版本"
                @click="openVersionModal"
              />
            </div>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-muted text-muted">
                <tr>
                  <th class="px-4 py-3 font-medium">
                    版本
                  </th>
                  <th class="px-4 py-3 font-medium">
                    通道
                  </th>
                  <th class="px-4 py-3 font-medium">
                    状态
                  </th>
                  <th class="px-4 py-3 font-medium">
                    强制更新
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="versions.length === 0">
                  <td class="px-4 py-8 text-center text-muted" colspan="5">
                    暂无版本
                  </td>
                </tr>
                <template v-else>
                  <tr
                    v-for="version in versions"
                    :key="version.id"
                    class="border-b border-muted last:border-b-0"
                  >
                    <td class="px-4 py-3">
                      <NuxtLink :to="`/versions/${version.id}`" class="font-medium text-highlighted">
                        {{ version.version }}
                      </NuxtLink>
                      <p v-if="version.buildNumber" class="text-xs text-muted">
                        build {{ version.buildNumber }}
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      <UBadge color="neutral" variant="subtle" :label="version.channel" />
                    </td>
                    <td class="px-4 py-3">
                      <UBadge
                        :color="statusColor(version.status)"
                        variant="subtle"
                        :label="statusLabel(version.status)"
                      />
                    </td>
                    <td class="px-4 py-3">
                      {{ version.forceUpdate ? '是' : '否' }}
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex justify-end">
                        <UButton
                          color="neutral"
                          variant="ghost"
                          icon="i-lucide-pencil"
                          :to="`/versions/${version.id}`"
                          aria-label="编辑"
                        />
                        <UButton
                          color="error"
                          variant="ghost"
                          icon="i-lucide-trash"
                          aria-label="删除版本"
                          @click="openDeleteVersion(version)"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="text-base font-semibold">
                  下载统计
                </h2>
                <p class="mt-1 text-sm text-muted">
                  统计检查更新请求和服务端签发的更新文件下载链接。
                </p>
              </div>

              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-refresh-cw"
                label="刷新统计"
                :loading="downloadingStats"
                @click="refreshDownloadStats"
              />
            </div>
          </template>

          <div class="space-y-6">
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-lg border border-muted px-4 py-3">
                <p class="text-sm text-muted">
                  检查更新
                </p>
                <p class="mt-2 text-2xl font-semibold">
                  {{ downloadStats?.summary.totalChecks || 0 }}
                </p>
              </div>
              <div class="rounded-lg border border-muted px-4 py-3">
                <p class="text-sm text-muted">
                  近 7 天
                </p>
                <p class="mt-2 text-2xl font-semibold">
                  {{ downloadStats?.summary.lastSevenChecks || 0 }}
                </p>
              </div>
              <div class="rounded-lg border border-muted px-4 py-3">
                <p class="text-sm text-muted">
                  更新可用
                </p>
                <p class="mt-2 text-2xl font-semibold">
                  {{ downloadStats?.summary.updateAvailableChecks || 0 }}
                </p>
              </div>
              <div class="rounded-lg border border-muted px-4 py-3">
                <p class="text-sm text-muted">
                  下载链接
                </p>
                <p class="mt-2 text-2xl font-semibold">
                  {{ downloadStats?.summary.downloadLinksIssued || 0 }}
                </p>
              </div>
            </div>

            <div>
              <div class="mb-3 flex items-center justify-between">
                <h3 class="text-sm font-medium">
                  近 {{ downloadStats?.rangeDays || 14 }} 天趋势
                </h3>
                <span class="text-xs text-muted">深色为检查，浅色为链接</span>
              </div>
              <div class="grid grid-cols-7 gap-2 md:grid-cols-[repeat(14,minmax(0,1fr))]">
                <div
                  v-for="day in downloadStats?.daily || []"
                  :key="day.date"
                  class="flex min-h-28 flex-col justify-end gap-2 rounded border border-muted px-2 py-2"
                >
                  <div class="flex h-16 items-end">
                    <div
                      class="w-1/2 rounded bg-primary"
                      :style="{ height: `${Math.max((day.checks / maxDailyStats) * 100, day.checks ? 8 : 2)}%` }"
                    />
                    <div
                      class="w-1/2 rounded bg-primary/35"
                      :style="{ height: `${Math.max((day.downloadLinksIssued / maxDailyStats) * 100, day.downloadLinksIssued ? 8 : 2)}%` }"
                    />
                  </div>
                  <div class="text-center">
                    <p class="text-xs font-medium">
                      {{ day.checks }} / {{ day.downloadLinksIssued }}
                    </p>
                    <p class="text-[11px] text-muted">
                      {{ formatShortDate(day.date) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid gap-6 xl:grid-cols-2">
              <div>
                <h3 class="mb-3 text-sm font-medium">
                  版本排行
                </h3>
                <div class="overflow-x-auto rounded border border-muted">
                  <table class="w-full text-left text-sm">
                    <thead class="border-b border-muted text-muted">
                      <tr>
                        <th class="px-3 py-2 font-medium">
                          版本
                        </th>
                        <th class="px-3 py-2 text-right font-medium">
                          检查
                        </th>
                        <th class="px-3 py-2 text-right font-medium">
                          链接
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="!downloadStats?.versions.length">
                        <td class="px-3 py-6 text-center text-muted" colspan="3">
                          暂无统计记录
                        </td>
                      </tr>
                      <tr
                        v-for="item in downloadStats?.versions || []"
                        :key="item.versionId || item.version"
                        class="border-b border-muted last:border-b-0"
                      >
                        <td class="px-3 py-2">
                          <NuxtLink
                            v-if="item.versionId"
                            :to="`/versions/${item.versionId}`"
                            class="font-medium text-highlighted"
                          >
                            {{ item.version }}
                          </NuxtLink>
                          <span v-else class="font-medium">{{ item.version }}</span>
                          <p class="text-xs text-muted">
                            {{ item.channel }}
                          </p>
                        </td>
                        <td class="px-3 py-2 text-right">
                          {{ item.checks }}
                        </td>
                        <td class="px-3 py-2 text-right">
                          {{ item.downloadLinksIssued }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 class="mb-3 text-sm font-medium">
                  来源分布
                </h3>
                <div class="space-y-2">
                  <div
                    v-for="item in downloadStats?.sources || []"
                    :key="item.source"
                    class="rounded border border-muted px-3 py-2"
                  >
                    <div class="flex items-center justify-between gap-3 text-sm">
                      <span>{{ sourceLabel(item.source) }}</span>
                      <span class="font-medium">{{ item.checks }}</span>
                    </div>
                    <div class="mt-2 h-2 overflow-hidden rounded bg-elevated">
                      <div
                        class="h-full rounded bg-primary"
                        :style="{ width: `${downloadStats?.summary.totalChecks ? (item.checks / downloadStats.summary.totalChecks) * 100 : 0}%` }"
                      />
                    </div>
                  </div>
                  <p v-if="!downloadStats?.sources.length" class="rounded border border-muted px-3 py-6 text-center text-sm text-muted">
                    暂无来源数据
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 class="mb-3 text-sm font-medium">
                最近检查
              </h3>
              <div class="overflow-x-auto rounded border border-muted">
                <table class="w-full text-left text-sm">
                  <thead class="border-b border-muted text-muted">
                    <tr>
                      <th class="px-3 py-2 font-medium">
                        时间
                      </th>
                      <th class="px-3 py-2 font-medium">
                        目标
                      </th>
                      <th class="px-3 py-2 font-medium">
                        来源
                      </th>
                      <th class="px-3 py-2 text-right font-medium">
                        链接
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!downloadStats?.recent.length">
                      <td class="px-3 py-6 text-center text-muted" colspan="4">
                        暂无检查记录
                      </td>
                    </tr>
                    <tr
                      v-for="item in downloadStats?.recent || []"
                      :key="item.id"
                      class="border-b border-muted last:border-b-0"
                    >
                      <td class="whitespace-nowrap px-3 py-2">
                        {{ formatDateTime(item.createdAt) }}
                      </td>
                      <td class="px-3 py-2">
                        <p class="font-medium">
                          {{ item.version }}
                        </p>
                        <p class="text-xs text-muted">
                          {{ item.channel }} / {{ item.platform }} / {{ item.arch }}
                        </p>
                      </td>
                      <td class="px-3 py-2">
                        <UBadge color="neutral" variant="subtle" :label="sourceLabel(item.source)" />
                      </td>
                      <td class="px-3 py-2 text-right">
                        {{ item.filesIssued }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <aside class="space-y-4">
        <UCard>
          <template #header>
            <div>
              <h2 class="text-base font-semibold">
                更新接口
              </h2>
              <p class="mt-1 text-sm text-muted">
                选择目标后复制完整 URL，可直接在浏览器或客户端中测试。
              </p>
            </div>
          </template>

          <div class="space-y-4 text-sm">
            <div class="grid gap-3">
              <UFormField label="Channel" name="endpointChannel">
                <USelect v-model="endpointForm.channel" class="w-full" :items="channelItems" />
              </UFormField>

              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Platform" name="endpointPlatform">
                  <USelect v-model="endpointForm.platform" class="w-full" :items="platformItems" />
                </UFormField>

                <UFormField label="Arch" name="endpointArch">
                  <USelect v-model="endpointForm.arch" class="w-full" :items="archItems" />
                </UFormField>
              </div>
            </div>

            <div>
              <div class="mb-1 flex items-center justify-between gap-2">
                <p class="text-muted">
                  自定义检查
                </p>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-copy"
                  aria-label="复制自定义检查 URL"
                  :disabled="!checkUpdateUrl"
                  @click="copyText(checkUpdateUrl, '自定义检查 URL')"
                />
              </div>
              <code class="block break-all rounded bg-elevated px-2 py-1 text-xs">
                {{ checkUpdateUrl || '-' }}
              </code>
            </div>

            <div>
              <div class="mb-1 flex items-center justify-between gap-2">
                <p class="text-muted">
                  electron-updater
                </p>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-copy"
                  aria-label="复制 electron-updater URL"
                  :disabled="!metadataUrl"
                  @click="copyText(metadataUrl, 'electron-updater URL')"
                />
              </div>
              <code class="block break-all rounded bg-elevated px-2 py-1 text-xs">
                {{ metadataUrl || '-' }}
              </code>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">
              状态
            </h2>
          </template>

          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-muted">启用状态</span>
              <UBadge
                :color="app?.enabled ? 'success' : 'neutral'"
                variant="subtle"
                :label="app?.enabled ? '启用' : '停用'"
              />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">默认通道</span>
              <UBadge color="neutral" variant="subtle" :label="app?.defaultChannel || '-'" />
            </div>
          </div>
        </UCard>
      </aside>
    </section>

    <UModal
      v-model:open="versionModalOpen"
      title="创建版本"
      description="创建 Electron 更新版本草稿，后续可上传全量包或增量包。"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <form id="create-version-form" class="grid gap-4" @submit.prevent="createVersion">
          <UAlert
            v-if="versionError"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="versionError"
          />

          <UFormField
            label="版本号"
            name="version"
            description="MVP 阶段使用标准 semver，例如 1.2.0。"
            required
          >
            <UInput v-model="versionForm.version" class="w-full" placeholder="1.0.0" />
          </UFormField>

          <UFormField label="构建号" name="buildNumber">
            <UInput v-model="versionForm.buildNumber" class="w-full" placeholder="100" />
          </UFormField>

          <UFormField label="通道" name="channel" required>
            <UInput v-model="versionForm.channel" class="w-full" placeholder="latest" />
          </UFormField>

          <USwitch v-model="versionForm.forceUpdate" label="强制更新" />

          <UFormField label="更新说明" name="releaseNotes">
            <UTextarea v-model="versionForm.releaseNotes" class="w-full" :rows="4" />
          </UFormField>
        </form>
      </template>

      <template #footer="{ close }">
        <UButton
          color="neutral"
          variant="outline"
          label="取消"
          @click="close"
        />
        <UButton
          type="submit"
          form="create-version-form"
          icon="i-lucide-save"
          label="保存"
          :loading="creatingVersion"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="deleteVersionOpen"
      title="删除版本"
      description="删除后会移除该版本的数据库记录、关联升级文件记录和发布指针。"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :title="`确认删除版本 ${pendingDeleteVersion?.version || ''}？`"
            description="此操作会删除版本记录、关联文件记录和发布指针。"
          />

          <UCheckbox
            v-model="deleteVersionObjects"
            :disabled="pendingDeleteObjectKeys.length === 0"
            label="同时删除对象存储中的文件"
          />

          <div v-if="pendingDeleteObjectKeys.length > 0" class="space-y-2">
            <p class="text-sm text-muted">
              将删除以下对象：
            </p>
            <code class="block max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-elevated px-3 py-2 text-xs">
              {{ pendingDeleteObjectKeys.join('\n') }}
            </code>
          </div>

          <p v-else class="text-sm text-muted">
            该版本暂无关联上传文件。
          </p>
        </div>
      </template>

      <template #footer="{ close }">
        <UButton
          color="neutral"
          variant="outline"
          label="取消"
          :disabled="deletingVersion"
          @click="close"
        />
        <UButton
          color="error"
          icon="i-lucide-trash"
          label="删除"
          :loading="deletingVersion"
          @click="deleteVersion"
        />
      </template>
    </UModal>
  </main>
</template>
