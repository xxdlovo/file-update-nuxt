<script setup lang="ts">
type DashboardSummary = {
  stats: {
    apps: number
    fileProjects: number
    publishedElectronVersions: number
    publishedFileVersions: number
    activeElectronReleases: number
    activeFileReleases: number
    activeReleases: number
    uploadedFiles: number
    lastSevenAppChecks: number
    lastSevenFileChecks: number
    lastSevenFileDownloads: number
    lastSevenClientEvents: number
    uniqueClients: number
  }
  dailyActivity: Array<{
    date: string
    checks: number
    downloads: number
    clientEvents: number
  }>
  recentElectronReleases: Array<{
    id: number
    appId: number
    appName: string
    versionId: number
    version: string
    channel: string
    platform: string
    arch: string
    publishedAt: string
  }>
  recentUpdateFiles: Array<{
    id: number
    appId: number
    appName: string
    versionId: number
    version: string
    platform: string
    arch: string
    packageType: string
    fileName: string
    size: number
    createdAt: string
  }>
  recentFileReleases: Array<{
    id: number
    fileProjectId: number
    projectName: string
    fileVersionId: number
    version: string
    channel: string
    environment: string
    visibility: string
    publishedAt: string
  }>
  recentClients: Array<{
    id: number
    type: 'app' | 'file'
    targetId: number
    targetName: string
    targetSlug: string
    version: string
    clientId: string
    clientName: string
    platform: string
    arch: string
    eventCount: number
    startupCount: number
    downloadCount: number
    errorCount: number
    lastSeenAt: string
  }>
}

const { data, pending } = useLazyFetch<DashboardSummary>('/api/dashboard/summary')

const stats = computed(() => data.value?.stats || {
  apps: 0,
  fileProjects: 0,
  publishedElectronVersions: 0,
  publishedFileVersions: 0,
  activeElectronReleases: 0,
  activeFileReleases: 0,
  activeReleases: 0,
  uploadedFiles: 0,
  lastSevenAppChecks: 0,
  lastSevenFileChecks: 0,
  lastSevenFileDownloads: 0,
  lastSevenClientEvents: 0,
  uniqueClients: 0
})

const statCards = computed(() => [{
  label: '应用',
  value: stats.value.apps,
  icon: 'i-lucide-monitor-up',
  hint: 'Electron 应用总数'
}, {
  label: '普通文件',
  value: stats.value.fileProjects,
  icon: 'i-lucide-files',
  hint: '文件项目总数'
}, {
  label: '已发布版本',
  value: stats.value.publishedElectronVersions + stats.value.publishedFileVersions,
  icon: 'i-lucide-badge-check',
  hint: `Electron ${stats.value.publishedElectronVersions} / 文件 ${stats.value.publishedFileVersions}`
}, {
  label: '活跃发布',
  value: stats.value.activeReleases,
  icon: 'i-lucide-radio',
  hint: `Electron ${stats.value.activeElectronReleases} / 文件 ${stats.value.activeFileReleases}`
}, {
  label: '上传文件',
  value: stats.value.uploadedFiles,
  icon: 'i-lucide-upload-cloud',
  hint: 'Electron 升级文件记录'
}, {
  label: '近 7 天检查',
  value: stats.value.lastSevenAppChecks + stats.value.lastSevenFileChecks,
  icon: 'i-lucide-radar',
  hint: `Electron ${stats.value.lastSevenAppChecks} / 文件 ${stats.value.lastSevenFileChecks}`
}, {
  label: '近 7 天下载',
  value: stats.value.lastSevenFileDownloads,
  icon: 'i-lucide-download',
  hint: '普通文件下载事件'
}, {
  label: '客户端事件',
  value: stats.value.lastSevenClientEvents,
  icon: 'i-lucide-activity',
  hint: `已识别客户端 ${stats.value.uniqueClients}`
}])
const maxDailyActivity = computed(() => Math.max(
  ...(data.value?.dailyActivity.map(item => Math.max(item.checks, item.downloads, item.clientEvents)) || [0]),
  1
))

function formatTime(value: string) {
  return new Date(value).toLocaleString()
}

function formatBytes(value: number) {
  if (!value) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)

  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatShortDate(value: string) {
  return value.slice(5)
}
</script>

<template>
  <main>
    <section class="border-b border-muted px-6 py-5">
      <p class="text-sm text-muted">
        总览
      </p>
      <h1 class="mt-1 text-2xl font-semibold">
        Dashboard
      </h1>
    </section>

    <section class="space-y-6 px-6 py-6">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UCard v-for="card in statCards" :key="card.label">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm text-muted">
                {{ card.label }}
              </p>
              <p class="mt-2 text-3xl font-semibold">
                {{ pending ? '-' : card.value }}
              </p>
            </div>
            <UIcon :name="card.icon" class="size-5 text-muted" />
          </div>
          <p class="mt-3 text-xs text-muted">
            {{ card.hint }}
          </p>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <div>
            <h2 class="text-base font-semibold">
              近 14 天活动趋势
            </h2>
            <p class="mt-1 text-sm text-muted">
              深色为检查更新，浅色为下载，绿色为客户端上报事件。
            </p>
          </div>
        </template>

        <div class="grid grid-cols-7 gap-2 md:grid-cols-[repeat(14,minmax(0,1fr))]">
          <div
            v-for="day in data?.dailyActivity || []"
            :key="day.date"
            class="flex min-h-28 flex-col justify-end gap-2 rounded border border-muted px-2 py-2"
          >
            <div class="flex h-16 items-end gap-1">
              <div
                class="w-1/3 rounded bg-primary"
                :style="{ height: `${Math.max((day.checks / maxDailyActivity) * 100, day.checks ? 8 : 2)}%` }"
              />
              <div
                class="w-1/3 rounded bg-primary/35"
                :style="{ height: `${Math.max((day.downloads / maxDailyActivity) * 100, day.downloads ? 8 : 2)}%` }"
              />
              <div
                class="w-1/3 rounded bg-green-500"
                :style="{ height: `${Math.max((day.clientEvents / maxDailyActivity) * 100, day.clientEvents ? 8 : 2)}%` }"
              />
            </div>
            <div class="text-center">
              <p class="text-xs font-medium">
                {{ day.checks + day.downloads + day.clientEvents }}
              </p>
              <p class="text-[11px] text-muted">
                {{ formatShortDate(day.date) }}
              </p>
            </div>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div>
            <h2 class="text-base font-semibold">
              最近活跃客户端
            </h2>
            <p class="mt-1 text-sm text-muted">
              来自 Electron 应用和普通文件的客户端上报汇总。
            </p>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-muted text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">客户端</th>
                <th class="px-4 py-3 font-medium">项目</th>
                <th class="px-4 py-3 font-medium">版本/平台</th>
                <th class="px-4 py-3 font-medium">事件</th>
                <th class="px-4 py-3 text-right font-medium">最后活跃</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!data?.recentClients.length">
                <td class="px-4 py-8 text-center text-muted" colspan="5">
                  暂无客户端上报
                </td>
              </tr>
              <tr
                v-for="client in data?.recentClients"
                :key="`${client.type}:${client.id}`"
                class="border-b border-muted last:border-b-0"
              >
                <td class="px-4 py-3">
                  <p class="font-medium">
                    {{ client.clientName }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ client.clientId }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <UBadge
                      :color="client.type === 'app' ? 'primary' : 'neutral'"
                      variant="subtle"
                      :label="client.type === 'app' ? 'Electron' : '文件'"
                    />
                    <span>{{ client.targetName }}</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <p>{{ client.version }}</p>
                  <p class="text-xs text-muted">{{ client.platform }} / {{ client.arch }}</p>
                </td>
                <td class="px-4 py-3">
                  <p>{{ client.eventCount }}</p>
                  <p class="text-xs text-muted">
                    启动 {{ client.startupCount }} / 下载 {{ client.downloadCount }} / 错误 {{ client.errorCount }}
                  </p>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-muted">
                  {{ formatTime(client.lastSeenAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <div class="grid gap-6 xl:grid-cols-2">
        <UCard>
          <template #header>
            <div>
              <h2 class="text-base font-semibold">
                最近 Electron 发布
              </h2>
              <p class="mt-1 text-sm text-muted">
                当前活跃的发布指针。
              </p>
            </div>
          </template>

          <div class="divide-y divide-muted">
            <div v-if="!data?.recentElectronReleases.length" class="py-8 text-center text-sm text-muted">
              暂无发布记录
            </div>
            <NuxtLink
              v-for="release in data?.recentElectronReleases"
              :key="release.id"
              :to="`/versions/${release.versionId}`"
              class="flex items-center justify-between gap-4 py-3"
            >
              <div class="min-w-0">
                <p class="truncate font-medium">
                  {{ release.appName }} v{{ release.version }}
                </p>
                <p class="text-sm text-muted">
                  {{ release.channel }} / {{ release.platform }} / {{ release.arch }}
                </p>
              </div>
              <span class="shrink-0 text-xs text-muted">{{ formatTime(release.publishedAt) }}</span>
            </NuxtLink>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div>
              <h2 class="text-base font-semibold">
                最近普通文件发布
              </h2>
              <p class="mt-1 text-sm text-muted">
                独立文件更新接口当前可见的发布。
              </p>
            </div>
          </template>

          <div class="divide-y divide-muted">
            <div v-if="!data?.recentFileReleases.length" class="py-8 text-center text-sm text-muted">
              暂无发布记录
            </div>
            <NuxtLink
              v-for="release in data?.recentFileReleases"
              :key="release.id"
              :to="`/file-versions/${release.fileVersionId}`"
              class="flex items-center justify-between gap-4 py-3"
            >
              <div class="min-w-0">
                <p class="truncate font-medium">
                  {{ release.projectName }} v{{ release.version }}
                </p>
                <p class="text-sm text-muted">
                  {{ release.channel }} / {{ release.environment }} / {{ release.visibility }}
                </p>
              </div>
              <span class="shrink-0 text-xs text-muted">{{ formatTime(release.publishedAt) }}</span>
            </NuxtLink>
          </div>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <div>
            <h2 class="text-base font-semibold">
              最近上传的升级文件
            </h2>
            <p class="mt-1 text-sm text-muted">
              Electron 全量包、增量包和元数据文件。
            </p>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-muted text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">文件</th>
                <th class="px-4 py-3 font-medium">应用</th>
                <th class="px-4 py-3 font-medium">目标</th>
                <th class="px-4 py-3 font-medium">大小</th>
                <th class="px-4 py-3 text-right font-medium">上传时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!data?.recentUpdateFiles.length">
                <td class="px-4 py-8 text-center text-muted" colspan="5">
                  暂无上传记录
                </td>
              </tr>
              <tr
                v-for="file in data?.recentUpdateFiles"
                :key="file.id"
                class="border-b border-muted last:border-b-0"
              >
                <td class="px-4 py-3">
                  <NuxtLink :to="`/versions/${file.versionId}`" class="font-medium">
                    {{ file.fileName }}
                  </NuxtLink>
                </td>
                <td class="px-4 py-3">
                  {{ file.appName }} v{{ file.version }}
                </td>
                <td class="px-4 py-3">
                  {{ file.platform }} / {{ file.arch }} / {{ file.packageType }}
                </td>
                <td class="px-4 py-3">
                  {{ formatBytes(file.size) }}
                </td>
                <td class="px-4 py-3 text-right text-muted">
                  {{ formatTime(file.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </section>
  </main>
</template>
