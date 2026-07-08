<script setup lang="ts">
type StorageConfig = {
  id: number
  name: string
  provider: string
  bucket: string
  region: string
  endpoint: string | null
  uploadDir: string
  fileReleaseDir: string
  enabled: boolean
  verified: boolean
  verifiedAt: string | null
  lastVerifyStatus: string | null
  lastVerifyMessage: string | null
}

const runtimeConfig = useRuntimeConfig()
const { data } = useLazyFetch<{ items: StorageConfig[], total: number }>('/api/storage-configs')

const configs = computed(() => data.value?.items || [])
const verifiedCount = computed(() => configs.value.filter(config => config.enabled && config.verified).length)
const downloadUrlExpiresSeconds = computed(() => Number(runtimeConfig.public.downloadUrlExpiresSeconds || 600))

function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds} 秒`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return remainingSeconds ? `${minutes} 分 ${remainingSeconds} 秒` : `${minutes} 分钟`
}

function formatTime(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString()
}

function statusColor(config: StorageConfig) {
  if (config.verified) {
    return 'success'
  }

  if (config.lastVerifyStatus === 'failed') {
    return 'error'
  }

  return 'neutral'
}

function statusLabel(config: StorageConfig) {
  if (config.verified) {
    return '已验证'
  }

  if (config.lastVerifyStatus === 'failed') {
    return '验证失败'
  }

  return '未验证'
}
</script>

<template>
  <main>
    <section class="border-b border-muted px-6 py-5">
      <p class="text-sm text-muted">
        系统配置
      </p>
      <h1 class="mt-1 text-2xl font-semibold">
        设置
      </h1>
    </section>

    <section class="space-y-6 px-6 py-6">
      <div class="grid gap-4 lg:grid-cols-3">
        <UCard>
          <p class="text-sm text-muted">
            下载 URL 有效期
          </p>
          <p class="mt-2 text-3xl font-semibold">
            {{ formatDuration(downloadUrlExpiresSeconds) }}
          </p>
          <p class="mt-3 text-xs text-muted">
            来自 DOWNLOAD_URL_EXPIRES_SECONDS，默认 600 秒。
          </p>
        </UCard>

        <UCard>
          <p class="text-sm text-muted">
            存储配置
          </p>
          <p class="mt-2 text-3xl font-semibold">
            {{ configs.length }}
          </p>
          <p class="mt-3 text-xs text-muted">
            已保存的对象存储配置总数。
          </p>
        </UCard>

        <UCard>
          <p class="text-sm text-muted">
            可上传配置
          </p>
          <p class="mt-2 text-3xl font-semibold">
            {{ verifiedCount }}
          </p>
          <p class="mt-3 text-xs text-muted">
            已启用且验证成功的配置。
          </p>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-base font-semibold">
                OSS 配置检查
              </h2>
              <p class="mt-1 text-sm text-muted">
                上传文件时只会显示已启用且已验证的配置。
              </p>
            </div>
            <UButton
              to="/storage-configs"
              color="neutral"
              variant="outline"
              icon="i-lucide-database"
              label="管理存储配置"
            />
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-muted text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">名称</th>
                <th class="px-4 py-3 font-medium">Bucket</th>
                <th class="px-4 py-3 font-medium">前缀</th>
                <th class="px-4 py-3 font-medium">状态</th>
                <th class="px-4 py-3 text-right font-medium">最近验证</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="configs.length === 0">
                <td class="px-4 py-8 text-center text-muted" colspan="5">
                  暂无存储配置
                </td>
              </tr>
              <tr
                v-for="config in configs"
                :key="config.id"
                class="border-b border-muted last:border-b-0"
              >
                <td class="px-4 py-3">
                  <p class="font-medium">
                    {{ config.name }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ config.provider }} / {{ config.region }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <p>{{ config.bucket }}</p>
                  <p class="text-xs text-muted">
                    {{ config.endpoint || '-' }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <p>Electron: {{ config.uploadDir }}</p>
                  <p class="text-xs text-muted">
                    文件: {{ config.fileReleaseDir }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge :color="statusColor(config)" variant="subtle" :label="statusLabel(config)" />
                    <UBadge
                      :color="config.enabled ? 'success' : 'neutral'"
                      variant="subtle"
                      :label="config.enabled ? '启用' : '停用'"
                    />
                  </div>
                </td>
                <td class="px-4 py-3 text-right">
                  <p>{{ formatTime(config.verifiedAt) }}</p>
                  <p v-if="config.lastVerifyMessage" class="text-xs text-muted">
                    {{ config.lastVerifyMessage }}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </section>
  </main>
</template>
