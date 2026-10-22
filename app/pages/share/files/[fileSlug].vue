<script setup lang="ts">
definePageMeta({
  layout: false
})

type ShareFileVersion = {
  id: number
  version: string
  channel: string
  environment: string
  releaseNotes: string | null
  fileName: string
  size: number
  sha256: string | null
  mimeType: string | null
  visibility: string
  publishedAt: string | null
  downloadCount: number
  downloadUrl: string
}

type ShareFilePayload = {
  project: {
    id: number
    name: string
    slug: string
    category: string | null
    description: string | null
    defaultChannel: string
  }
  version: ShareFileVersion
  versions: ShareFileVersion[]
  release: {
    channel: string
    environment: string
    publishedAt: string
  }
}

const route = useRoute()
const toast = useToast()
const fileSlug = computed(() => String(route.params.fileSlug || ''))
const channel = computed(() => typeof route.query.channel === 'string' ? route.query.channel : undefined)
const environment = computed(() => {
  if (typeof route.query.env === 'string') {
    return route.query.env
  }

  if (typeof route.query.environment === 'string') {
    return route.query.environment
  }

  return undefined
})
const query = computed(() => ({
  channel: channel.value,
  env: environment.value
}))
const { data, error, status, refresh } = await useFetch<ShareFilePayload>(
  () => `/api/public/files/${encodeURIComponent(fileSlug.value)}/share`,
  {
    query,
    watch: [query]
  }
)

const loading = computed(() => status.value === 'pending' || status.value === 'idle')
const downloadPath = computed(() => {
  if (!data.value?.project.slug) {
    return ''
  }

  const params = new URLSearchParams()

  if (data.value.release.channel) {
    params.set('channel', data.value.release.channel)
  }

  if (data.value.release.environment) {
    params.set('env', data.value.release.environment)
  }

  const queryString = params.toString()

  return `/api/public/files/${encodeURIComponent(data.value.project.slug)}/share-download${queryString ? `?${queryString}` : ''}`
})

const versions = computed(() => data.value?.versions || [])

const directDownloadPath = computed(() => {
  if (!downloadPath.value) {
    return ''
  }

  return `${downloadPath.value}${downloadPath.value.includes('?') ? '&' : '?'}direct=1`
})

function versionDownloadPath(version: string) {
  if (!data.value?.project.slug) {
    return ''
  }

  const params = new URLSearchParams()

  params.set('channel', data.value.release.channel || data.value.project.defaultChannel)
  params.set('env', data.value.release.environment || 'prod')
  params.set('version', version)

  return `/api/public/files/${encodeURIComponent(data.value.project.slug)}/share-download?${params.toString()}`
}

function versionDirectPath(version: string) {
  const path = versionDownloadPath(version)

  return path ? `${path}&direct=1` : ''
}

const shareUrl = computed(() => {
  if (!import.meta.client) {
    return ''
  }

  return window.location.href
})

const projectName = computed(() => data.value?.project.name || '')
const remark = computed(() => data.value?.project.description || '')

useHead(() => ({
  title: projectName.value ? `${projectName.value} · 文件分享` : '文件分享',
  meta: remark.value
    ? [{ name: 'description', content: remark.value }]
    : []
}))

const errorTitle = computed(() => {
  const statusCode = error.value?.statusCode

  if (statusCode === 403) {
    return '当前文件版本未公开'
  }

  if (statusCode === 404) {
    return '分享内容不存在'
  }

  return '分享页暂时不可用'
})

const errorDescription = computed(() => {
  const statusCode = error.value?.statusCode

  if (statusCode === 403) {
    return '请确认普通文件版本的可见性已设置为 public，并且对应版本已经发布。'
  }

  if (statusCode === 404) {
    return '请确认分享链接、channel 和 env 参数是否正确。'
  }

  return error.value?.statusMessage || '请稍后重试。'
})

function formatFileSize(size: number) {
  if (!size) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)

  return `${(size / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatTime(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString()
}

async function copyShareUrl() {
  if (!shareUrl.value) {
    return
  }

  await navigator.clipboard.writeText(shareUrl.value)
  toast.add({
    title: '分享链接已复制',
    color: 'success',
    icon: 'i-lucide-copy-check'
  })
}
</script>

<template>
  <main class="min-h-screen bg-default text-default">
    <section class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header class="flex flex-col gap-4 border-b border-muted pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm text-muted">
            文件分享
          </p>
          <h1 class="mt-1 break-all text-2xl font-semibold">
            {{ projectName || '公开分享' }}
          </h1>
          <p v-if="remark" class="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-muted">
            {{ remark }}
          </p>
        </div>

        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          aria-label="刷新"
          :loading="loading"
          @click="refresh"
        />
      </header>

      <div class="flex w-full flex-1 flex-col gap-6 py-8">
        <UCard v-if="error" class="w-full">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div class="flex size-12 shrink-0 items-center justify-center rounded bg-elevated">
              <UIcon name="i-lucide-lock-keyhole" class="size-6 text-muted" />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-xl font-semibold">
                {{ errorTitle }}
              </h2>
              <p class="mt-2 text-sm text-muted">
                {{ errorDescription }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard v-else class="w-full">
          <template #header>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  v-if="data?.project.category"
                  color="neutral"
                  variant="subtle"
                  :label="data.project.category"
                />
                <UBadge
                  color="success"
                  variant="subtle"
                  label="公开文件"
                />
              </div>

              <div class="flex shrink-0 gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-copy"
                  label="复制链接"
                  :disabled="!shareUrl"
                  @click="copyShareUrl"
                />
                <UButton
                  icon="i-lucide-download"
                  label="下载"
                  :to="downloadPath || undefined"
                  :disabled="!downloadPath"
                  external
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-zap"
                  label="直连下载"
                  title="直接跳转对象存储 / CDN，速度更快，但文件名以存储对象为准"
                  :to="directDownloadPath || undefined"
                  :disabled="!directDownloadPath"
                  external
                />
              </div>
            </div>
          </template>

          <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div class="space-y-5">
              <div class="rounded border border-muted p-4">
                <p class="text-sm text-muted">
                  文件名
                </p>
                <p class="mt-1 break-all text-lg font-medium">
                  {{ data?.version.fileName || '-' }}
                </p>
              </div>

              <div>
                <p class="text-sm text-muted">
                  更新说明
                </p>
                <p class="mt-2 whitespace-pre-wrap text-sm">
                  {{ data?.version.releaseNotes || '暂无更新说明。' }}
                </p>
              </div>

              <div>
                <p class="text-sm text-muted">
                  SHA-256
                </p>
                <code class="mt-2 block break-all rounded bg-elevated px-3 py-2 text-xs">
                  {{ data?.version.sha256 || '-' }}
                </code>
              </div>
            </div>

            <aside class="space-y-3 text-sm">
              <div class="flex items-center justify-between gap-4">
                <span class="text-muted">版本</span>
                <span class="font-medium">{{ data?.version.version || '-' }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-muted">大小</span>
                <span>{{ formatFileSize(data?.version.size || 0) }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-muted">Channel</span>
                <UBadge color="neutral" variant="subtle" :label="data?.release.channel || '-'" />
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-muted">Environment</span>
                <UBadge color="neutral" variant="subtle" :label="data?.release.environment || '-'" />
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-muted">发布时间</span>
                <span class="text-right">{{ formatTime(data?.version.publishedAt || null) }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-muted">下载次数</span>
                <span>{{ data?.version.downloadCount || 0 }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-muted">类型</span>
                <span class="text-right">{{ data?.version.mimeType || '-' }}</span>
              </div>
            </aside>
          </div>
        </UCard>

        <UCard v-if="!error && versions.length > 1" class="w-full">
          <template #header>
            <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 class="text-lg font-semibold">
                最近版本
              </h2>
              <p class="text-xs text-muted">
                仅列出可见性为 public 的已发布版本，按版本号从新到旧，最多 10 个
              </p>
            </div>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-muted text-muted">
                <tr>
                  <th class="px-3 py-3 font-medium">
                    版本
                  </th>
                  <th class="px-3 py-3 font-medium">
                    文件
                  </th>
                  <th class="px-3 py-3 font-medium">
                    大小
                  </th>
                  <th class="px-3 py-3 font-medium">
                    发布时间
                  </th>
                  <th class="px-3 py-3 text-right font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in versions"
                  :key="item.id"
                  class="border-b border-muted last:border-b-0"
                >
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-medium">{{ item.version }}</span>
                      <UBadge
                        v-if="item.id === data?.version.id"
                        color="success"
                        variant="subtle"
                        label="当前"
                      />
                    </div>
                  </td>
                  <td class="max-w-[22rem] px-3 py-3 break-all">
                    {{ item.fileName }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-3">
                    {{ formatFileSize(item.size) }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-3">
                    {{ formatTime(item.publishedAt) }}
                  </td>
                  <td class="px-3 py-3 text-right">
                    <div class="flex justify-end gap-2">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-download"
                        label="下载"
                        :to="versionDownloadPath(item.version) || undefined"
                        external
                      />
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-zap"
                        aria-label="直连下载"
                        title="直连下载：直接跳转对象存储 / CDN，文件名以存储对象为准"
                        :to="versionDirectPath(item.version) || undefined"
                        external
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="mt-3 text-xs text-muted">
            「下载」由服务器转发并使用原始文件名（会按 SHA-256 缓存，热门文件不重复占用 CDN 流量）；「直连」直接跳转对象存储 / CDN，速度更快，但保存的文件名以存储对象为准。
          </p>
        </UCard>
      </div>
    </section>
  </main>
</template>
