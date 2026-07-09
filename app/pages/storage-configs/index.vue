<script setup lang="ts">
type StorageProvider = 'aliyun_oss' | 'tencent_cos' | 'qiniu_kodo' | 'aws_s3' | 'upyun_uss'

type StorageConfig = {
  id: number
  name: string
  provider: StorageProvider
  region: string
  accessKeyId: string
  bucket: string
  endpoint: string | null
  publicBaseUrl: string | null
  cdnAuthTokenConfigured: boolean
  uploadDir: string
  fileReleaseDir: string
  enabled: boolean
  verified: boolean
  verifiedAt: string | null
  lastVerifyStatus: string | null
  lastVerifyMessage: string | null
}

const providerItems = [{
  label: '阿里云 OSS',
  value: 'aliyun_oss'
}, {
  label: '腾讯云 COS',
  value: 'tencent_cos'
}, {
  label: '七牛云 Kodo',
  value: 'qiniu_kodo'
}, {
  label: 'AWS S3',
  value: 'aws_s3'
}, {
  label: 'UPYUN USS',
  value: 'upyun_uss'
}]

const providerLabels: Record<StorageProvider, string> = {
  aliyun_oss: '阿里云 OSS',
  tencent_cos: '腾讯云 COS',
  qiniu_kodo: '七牛云 Kodo',
  aws_s3: 'AWS S3',
  upyun_uss: 'UPYUN USS'
}

const toast = useToast()
const defaultUpyunCdnAuthToken = 'yvAAxOQXup34nX'
const createOpen = ref(false)
const verifyConfirmOpen = ref(false)
const creating = ref(false)
const verifyingId = ref<number | null>(null)
const errorMessage = ref('')
const pendingVerifyConfig = ref<StorageConfig | null>(null)
const editingConfig = ref<StorageConfig | null>(null)

const { data, refresh } = useLazyFetch<{ items: StorageConfig[], total: number }>('/api/storage-configs')

const configs = computed(() => data.value?.items || [])
const form = reactive({
  name: '',
  provider: 'aliyun_oss' as StorageProvider,
  region: '',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: '',
  endpoint: '',
  publicBaseUrl: '',
  cdnAuthToken: '',
  uploadDir: 'electron-updates',
  fileReleaseDir: 'files',
  enabled: true
})
const regionPlaceholder = computed(() => {
  if (form.provider === 'aliyun_oss') {
    return 'oss-cn-hangzhou'
  }

  if (form.provider === 'tencent_cos') {
    return 'ap-guangzhou'
  }

  if (form.provider === 'qiniu_kodo') {
    return 'z0'
  }

  if (form.provider === 'upyun_uss') {
    return ''
  }

  return 'us-east-1'
})
const endpointPlaceholder = computed(() => {
  if (form.provider === 'aliyun_oss') {
    return 'oss-cn-hangzhou.aliyuncs.com'
  }

  if (form.provider === 'tencent_cos') {
    return 'cos.ap-guangzhou.myqcloud.com'
  }

  if (form.provider === 'qiniu_kodo') {
    return 'upload.qiniup.com'
  }

  if (form.provider === 'upyun_uss') {
    return 's3.api.upyun.com'
  }

  return 's3.us-east-1.amazonaws.com'
})
const publicBaseUrlHint = computed(() => form.provider === 'qiniu_kodo'
  ? '建议填写七牛融合 CDN 或下载域名'
  : '可选')

watch(() => form.provider, (provider) => {
  if (provider !== 'upyun_uss') {
    if (form.region === 'global') {
      form.region = ''
    }

    if (form.endpoint === 's3.api.upyun.com') {
      form.endpoint = ''
    }

    if (form.cdnAuthToken === defaultUpyunCdnAuthToken) {
      form.cdnAuthToken = ''
    }

    return
  }

  form.region = 'global'
  form.endpoint = 's3.api.upyun.com'
  if (!editingConfig.value && !form.cdnAuthToken) {
    form.cdnAuthToken = defaultUpyunCdnAuthToken
  }
})

function resetForm() {
  form.name = ''
  form.provider = 'aliyun_oss'
  form.region = ''
  form.accessKeyId = ''
  form.accessKeySecret = ''
  form.bucket = ''
  form.endpoint = ''
  form.publicBaseUrl = ''
  form.cdnAuthToken = ''
  form.uploadDir = 'electron-updates'
  form.fileReleaseDir = 'files'
  form.enabled = true
  errorMessage.value = ''
}

function openCreateModal() {
  editingConfig.value = null
  resetForm()
  createOpen.value = true
}

function openEditModal(config: StorageConfig) {
  editingConfig.value = config
  form.name = config.name
  form.provider = config.provider
  form.region = config.provider === 'upyun_uss' ? 'global' : config.region
  form.accessKeyId = config.accessKeyId
  form.accessKeySecret = ''
  form.bucket = config.bucket
  form.endpoint = config.provider === 'upyun_uss' ? 's3.api.upyun.com' : config.endpoint || ''
  form.publicBaseUrl = config.publicBaseUrl || ''
  form.cdnAuthToken = ''
  form.uploadDir = config.uploadDir
  form.fileReleaseDir = config.fileReleaseDir
  form.enabled = config.enabled
  errorMessage.value = ''
  createOpen.value = true
}

function providerLabel(provider: StorageProvider) {
  return providerLabels[provider] || provider
}

function defaultEndpoint(config: StorageConfig) {
  if (config.provider === 'aliyun_oss') {
    return `${config.region}.aliyuncs.com`
  }

  if (config.provider === 'tencent_cos') {
    return `cos.${config.region}.myqcloud.com`
  }

  if (config.provider === 'qiniu_kodo') {
    return 'upload.qiniup.com'
  }

  if (config.provider === 'upyun_uss') {
    return 's3.api.upyun.com'
  }

  return `s3.${config.region}.amazonaws.com`
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

async function submitConfig() {
  errorMessage.value = ''
  creating.value = true

  try {
    await $fetch(editingConfig.value ? `/api/storage-configs/${editingConfig.value.id}` : '/api/storage-configs', {
      method: editingConfig.value ? 'PATCH' : 'POST',
      body: form
    })
    toast.add({
      title: editingConfig.value ? '存储配置已更新' : '存储配置已创建',
      color: 'success'
    })
    createOpen.value = false
    editingConfig.value = null
    resetForm()
    await refresh()
  } catch (error) {
    errorMessage.value = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : editingConfig.value ? '更新失败' : '创建失败'
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
            管理上传升级包和普通文件使用的对象存储配置。
          </p>
        </div>

        <UButton icon="i-lucide-plus" label="新增配置" @click="openCreateModal" />
      </div>
    </section>

    <section class="px-6 py-6">
      <UCard>
        <template #header>
          <div>
            <h2 class="text-base font-semibold">
              对象存储
            </h2>
            <p class="mt-1 text-sm text-muted">
              已验证且启用的配置会出现在上传文件的选择列表中。
            </p>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-muted text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">名称</th>
                <th class="px-4 py-3 font-medium">Provider</th>
                <th class="px-4 py-3 font-medium">Bucket</th>
                <th class="px-4 py-3 font-medium">区域</th>
                <th class="px-4 py-3 font-medium">状态</th>
                <th class="px-4 py-3 font-medium">最近验证</th>
                <th class="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="configs.length === 0">
                <td class="px-4 py-8 text-center text-muted" colspan="7">
                  暂无存储配置
                </td>
              </tr>
              <tr v-for="config in configs" :key="config.id" class="border-b border-muted last:border-b-0">
                <td class="px-4 py-3">
                  <p class="font-medium">
                    {{ config.name }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ config.accessKeyId }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <UBadge color="neutral" variant="subtle" :label="providerLabel(config.provider)" />
                </td>
                <td class="px-4 py-3">
                  <p>{{ config.bucket }}</p>
                  <p class="text-xs text-muted">
                    {{ config.endpoint || defaultEndpoint(config) }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  {{ config.provider === 'upyun_uss' ? '-' : config.region }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge :color="statusColor(config)" variant="subtle" :label="statusLabel(config)" />
                    <UBadge :color="config.enabled ? 'success' : 'neutral'" variant="subtle"
                      :label="config.enabled ? '启用' : '停用'" />
                    <UBadge v-if="config.provider === 'upyun_uss' && config.cdnAuthTokenConfigured" color="primary"
                      variant="subtle" label="CDN Token" />
                  </div>
                </td>
                <td class="px-4 py-3">
                  <p>{{ formatTime(config.verifiedAt) }}</p>
                  <p v-if="config.lastVerifyMessage" class="text-xs text-muted">
                    {{ config.lastVerifyMessage }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-1">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" aria-label="编辑配置"
                      @click="openEditModal(config)" />
                    <UButton color="neutral" variant="ghost" icon="i-lucide-shield-check" aria-label="验证配置"
                      :loading="verifyingId === config.id" @click="openVerifyConfirm(config)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </section>

    <UModal v-model:open="createOpen" :title="editingConfig ? '编辑对象存储' : '新增对象存储'"
      :description="editingConfig ? '修改后需要重新验证，验证成功的配置才能用于上传。' : '保存后请执行验证，验证成功的配置才能用于上传。'"
      :ui="{ footer: 'justify-end' }">
      <template #body>
        <form id="create-storage-config-form" class="grid gap-4" @submit.prevent="submitConfig">
          <UAlert v-if="errorMessage" color="error" variant="soft" icon="i-lucide-circle-alert" :title="errorMessage" />

          <UFormField label="Provider" name="provider" required>
            <USelect v-model="form.provider" class="w-full" :items="providerItems" value-key="value" />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="名称" name="name" required>
              <UInput v-model="form.name" class="w-full" placeholder="生产对象存储" />
            </UFormField>

            <UFormField v-if="form.provider !== 'upyun_uss'" label="Region" name="region" required>
              <UInput v-model="form.region" class="w-full" :placeholder="regionPlaceholder" />
            </UFormField>

            <UFormField label="Access Key ID" name="accessKeyId" required>
              <UInput v-model="form.accessKeyId" class="w-full" />
            </UFormField>

            <UFormField label="Access Key Secret" name="accessKeySecret" :required="!editingConfig">
              <UInput v-model="form.accessKeySecret" class="w-full" type="password"
                :placeholder="editingConfig ? '留空则保持不变' : ''" />
            </UFormField>

            <UFormField label="Bucket" name="bucket" required>
              <UInput v-model="form.bucket" class="w-full" />
            </UFormField>

            <UFormField label="Endpoint" name="endpoint" hint="可选">
              <UInput v-model="form.endpoint" class="w-full" :disabled="form.provider === 'upyun_uss'"
                :placeholder="endpointPlaceholder" />
            </UFormField>

            <UFormField label="Electron 前缀" name="uploadDir" required>
              <UInput v-model="form.uploadDir" class="w-full" />
            </UFormField>

            <UFormField label="普通文件前缀" name="fileReleaseDir" required>
              <UInput v-model="form.fileReleaseDir" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="公开访问域名" name="publicBaseUrl" :hint="publicBaseUrlHint">
            <UInput v-model="form.publicBaseUrl" class="w-full" placeholder="https://cdn.example.com" />
          </UFormField>

          <UFormField v-if="form.provider === 'upyun_uss'" label="CDN Token 防盗链密钥" name="cdnAuthToken"
            :hint="editingConfig ? '留空则保持不变' : '用于生成 _upt 参数'">
            <UInput v-model="form.cdnAuthToken" class="w-full" type="password" placeholder="xxxxxxxxxxxx" />
          </UFormField>

          <USwitch v-model="form.enabled" label="启用配置" />
        </form>
      </template>

      <template #footer="{ close }">
        <UButton color="neutral" variant="outline" label="取消" :disabled="creating" @click="close" />
        <UButton type="submit" form="create-storage-config-form" icon="i-lucide-save" label="保存" :loading="creating" />
      </template>
    </UModal>

    <UModal v-model:open="verifyConfirmOpen" title="验证存储配置" description="系统会上传一个很小的临时测试对象，确认写入成功后立即删除。"
      :ui="{ footer: 'justify-end' }">
      <template #body>
        <UAlert color="warning" variant="soft" icon="i-lucide-triangle-alert" title="验证会执行真实的上传和删除操作"
          :description="`目标：${pendingVerifyConfig ? providerLabel(pendingVerifyConfig.provider) : '-'} / ${pendingVerifyConfig?.bucket || '-'}`" />
      </template>

      <template #footer="{ close }">
        <UButton color="neutral" variant="outline" label="取消" :disabled="verifyingId !== null" @click="close" />
        <UButton color="warning" icon="i-lucide-shield-check" label="开始验证"
          :loading="verifyingId === pendingVerifyConfig?.id" @click="verifyConfig" />
      </template>
    </UModal>
  </main>
</template>
