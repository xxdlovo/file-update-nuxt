<script setup lang="ts">
type StorageConfig = {
  id: number
  name: string
  provider: string
  region: string
  accessKeyId: string
  bucket: string
  endpoint: string | null
  publicBaseUrl: string | null
  uploadDir: string
  fileReleaseDir: string
  enabled: boolean
  verified: boolean
  verifiedAt: string | null
  lastVerifyStatus: string | null
  lastVerifyMessage: string | null
}

const toast = useToast()
const createOpen = ref(false)
const verifyConfirmOpen = ref(false)
const creating = ref(false)
const verifyingId = ref<number | null>(null)
const errorMessage = ref('')
const pendingVerifyConfig = ref<StorageConfig | null>(null)

const { data, refresh } = await useFetch<{ items: StorageConfig[], total: number }>('/api/storage-configs')

const configs = computed(() => data.value?.items || [])
const form = reactive({
  name: '',
  region: '',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: '',
  endpoint: '',
  publicBaseUrl: '',
  uploadDir: 'electron-updates',
  fileReleaseDir: 'files',
  enabled: true
})

function resetForm() {
  form.name = ''
  form.region = ''
  form.accessKeyId = ''
  form.accessKeySecret = ''
  form.bucket = ''
  form.endpoint = ''
  form.publicBaseUrl = ''
  form.uploadDir = 'electron-updates'
  form.fileReleaseDir = 'files'
  form.enabled = true
  errorMessage.value = ''
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

function formatTime(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString()
}

async function createConfig() {
  errorMessage.value = ''
  creating.value = true

  try {
    await $fetch('/api/storage-configs', {
      method: 'POST',
      body: form
    })
    toast.add({
      title: '存储配置已创建',
      color: 'success'
    })
    createOpen.value = false
    resetForm()
    await refresh()
  } catch (error) {
    errorMessage.value = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : '创建失败'
  } finally {
    creating.value = false
  }
}

function openVerifyConfirm(config: StorageConfig) {
  pendingVerifyConfig.value = config
  verifyConfirmOpen.value = true
}

async function verifyConfig() {
  if (!pendingVerifyConfig.value) {
    return
  }

  const config = pendingVerifyConfig.value

  verifyingId.value = config.id

  try {
    const result = await $fetch<StorageConfig & { verifyResult: { ok: boolean, message: string } }>(
      `/api/storage-configs/${config.id}/verify`,
      { method: 'POST' }
    )
    toast.add({
      title: result.verifyResult.ok ? '验证成功' : '验证失败',
      description: result.verifyResult.message,
      color: result.verifyResult.ok ? 'success' : 'error'
    })
    await refresh()
    verifyConfirmOpen.value = false
    pendingVerifyConfig.value = null
  } finally {
    verifyingId.value = null
  }
}
</script>

<template>
  <main>
    <section class="border-b border-muted px-6 py-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">
            存储配置
          </h1>
          <p class="mt-1 text-sm text-muted">
            管理用于上传升级包的阿里云对象存储配置。
          </p>
        </div>

        <UButton
          icon="i-lucide-plus"
          label="新增配置"
          @click="createOpen = true"
        />
      </div>
    </section>

    <section class="px-6 py-6">
      <UCard>
        <template #header>
          <div>
            <h2 class="text-base font-semibold">
              阿里云 OSS
            </h2>
            <p class="mt-1 text-sm text-muted">
              只有验证成功且启用的配置会出现在上传文件的选择列表中。
            </p>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-muted text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">名称</th>
                <th class="px-4 py-3 font-medium">Bucket</th>
                <th class="px-4 py-3 font-medium">区域</th>
                <th class="px-4 py-3 font-medium">状态</th>
                <th class="px-4 py-3 font-medium">最近验证</th>
                <th class="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="configs.length === 0">
                <td class="px-4 py-8 text-center text-muted" colspan="6">
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
                    {{ config.accessKeyId }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <p>{{ config.bucket }}</p>
                  <p class="text-xs text-muted">
                    {{ config.endpoint || `${config.region}.aliyuncs.com` }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  {{ config.region }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge
                      :color="statusColor(config)"
                      variant="subtle"
                      :label="statusLabel(config)"
                    />
                    <UBadge
                      :color="config.enabled ? 'success' : 'neutral'"
                      variant="subtle"
                      :label="config.enabled ? '启用' : '停用'"
                    />
                  </div>
                </td>
                <td class="px-4 py-3">
                  <p>{{ formatTime(config.verifiedAt) }}</p>
                  <p v-if="config.lastVerifyMessage" class="text-xs text-muted">
                    {{ config.lastVerifyMessage }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-shield-check"
                      aria-label="验证配置"
                      :loading="verifyingId === config.id"
                      @click="openVerifyConfirm(config)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </section>

    <UModal
      v-model:open="createOpen"
      title="新增阿里云 OSS"
      description="保存后请执行验证，验证成功的配置才能用于上传。"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <form id="create-storage-config-form" class="grid gap-4" @submit.prevent="createConfig">
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="errorMessage"
          />

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="名称" name="name" required>
              <UInput v-model="form.name" class="w-full" placeholder="生产 OSS" />
            </UFormField>

            <UFormField label="Region" name="region" required>
              <UInput v-model="form.region" class="w-full" placeholder="oss-cn-hangzhou" />
            </UFormField>

            <UFormField label="AccessKey ID" name="accessKeyId" required>
              <UInput v-model="form.accessKeyId" class="w-full" />
            </UFormField>

            <UFormField label="AccessKey Secret" name="accessKeySecret" required>
              <UInput v-model="form.accessKeySecret" class="w-full" type="password" />
            </UFormField>

            <UFormField label="Bucket" name="bucket" required>
              <UInput v-model="form.bucket" class="w-full" />
            </UFormField>

            <UFormField label="Endpoint" name="endpoint" hint="可选">
              <UInput v-model="form.endpoint" class="w-full" placeholder="oss-cn-hangzhou.aliyuncs.com" />
            </UFormField>

            <UFormField label="Electron 前缀" name="uploadDir" required>
              <UInput v-model="form.uploadDir" class="w-full" />
            </UFormField>

            <UFormField label="普通文件前缀" name="fileReleaseDir" required>
              <UInput v-model="form.fileReleaseDir" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="公开访问域名" name="publicBaseUrl" hint="可选">
            <UInput v-model="form.publicBaseUrl" class="w-full" placeholder="https://cdn.example.com" />
          </UFormField>

          <USwitch v-model="form.enabled" label="启用配置" />
        </form>
      </template>

      <template #footer="{ close }">
        <UButton
          color="neutral"
          variant="outline"
          label="取消"
          :disabled="creating"
          @click="close"
        />
        <UButton
          type="submit"
          form="create-storage-config-form"
          icon="i-lucide-save"
          label="保存"
          :loading="creating"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="verifyConfirmOpen"
      title="验证存储配置"
      description="系统会上传一个很小的临时测试对象，确认写入成功后立即删除。"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="验证会执行真实的上传和删除操作"
          :description="`目标 Bucket：${pendingVerifyConfig?.bucket || '-'}`"
        />
      </template>

      <template #footer="{ close }">
        <UButton
          color="neutral"
          variant="outline"
          label="取消"
          :disabled="verifyingId !== null"
          @click="close"
        />
        <UButton
          color="warning"
          icon="i-lucide-shield-check"
          label="开始验证"
          :loading="verifyingId === pendingVerifyConfig?.id"
          @click="verifyConfig"
        />
      </template>
    </UModal>
  </main>
</template>
