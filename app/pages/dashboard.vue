<script setup lang="ts">
type DashboardSummary = {
  stats: {
    apps: number
    fileProjects: number
    publishedElectronVersions: number
    publishedFileVersions: number
    activeReleases: number
    uploadedFiles: number
  }
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
}

const { data, pending } = useLazyFetch<DashboardSummary>('/api/dashboard/summary')

const stats = computed(() => data.value?.stats || {
  apps: 0,
  fileProjects: 0,
  publishedElectronVersions: 0,
  publishedFileVersions: 0,
  activeReleases: 0,
  uploadedFiles: 0
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
  hint: '当前可被检查更新命中的发布'
}, {
  label: '上传文件',
  value: stats.value.uploadedFiles,
  icon: 'i-lucide-upload-cloud',
  hint: 'Electron 升级文件记录'
}])

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
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
