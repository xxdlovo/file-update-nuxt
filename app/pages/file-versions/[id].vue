<script setup lang="ts">
type FileVersionDetail = {
  id: number
  fileProjectId: number
  version: string
  channel: string
  environment: string
  status: string
  releaseNotes: string | null
  fileName: string
  objectKey: string
  bucket: string
  endpoint: string | null
  size: number
  sha256: string | null
  mimeType: string | null
  visibility: string
  publishedAt: string | null
  project: {
    id: number
    name: string
    slug: string
    defaultChannel: string
  }
}

type UploadToken = {
  method: 'PUT' | 'POST'
  uploadUrl: string
  objectKey: string
  storageConfigId: number | null
  bucket: string
  endpoint?: string | null
  headers: Record<string, string>
  fields?: Record<string, string>
}

type StorageConfigOption = {
  id: number
  name: string
  provider: string
  bucket: string
  region: string
}

const route = useRoute()
const toast = useToast()
const versionId = computed(() => String(route.params.id))
const publishing = ref(false)
const revoking = ref(false)
const rollingBack = ref(false)
const uploading = ref(false)
const saving = ref(false)
const uploadOpen = ref(false)
const editOpen = ref(false)
const uploadError = ref('')
const editError = ref('')
const selectedFile = ref<File | null>(null)

const { data: version, refresh } = useLazyFetch<FileVersionDetail>(() => `/api/file-versions/${versionId.value}`)
const { data: storageConfigsData } = useLazyFetch<{ items: StorageConfigOption[], total: number }>(
  '/api/storage-configs?verified=true'
)

const uploadForm = reactive({
  storageConfigId: null as number | null
})
const editForm = reactive({
  version: '',
  channel: '',
  environment: 'prod',
  visibility: 'signed',
  releaseNotes: ''
})

const visibilityItems = [
  { label: '签名访问', value: 'signed' },
  { label: '公开分享', value: 'public' }
]

const storageConfigs = computed(() => storageConfigsData.value?.items || [])
const storageConfigItems = computed(() => storageConfigs.value.map(config => ({
  label: `${config.name} / ${providerLabel(config.provider)} / ${config.bucket}`,
  value: config.id
})))

function providerLabel(provider: string) {
  return {
    aliyun_oss: '阿里云 OSS',
    tencent_cos: '腾讯云 COS',
    qiniu_kodo: '七牛云 Kodo',
    aws_s3: 'AWS S3',
    upyun_uss: 'UPYUN USS'
  }[provider] || provider
}

watch(storageConfigs, (value) => {
  if (!uploadForm.storageConfigId && value[0]) {
    uploadForm.storageConfigId = value[0].id
  }
}, { immediate: true })

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

function visibilityLabel(visibility: string) {
  return visibility === 'public' ? '公开分享' : '签名访问'
}

function formatFileSize(size: number) {
  if (!size) {
    return '-'
  }

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }

  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

async function digestFile(file: File) {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = Array.from(new Uint8Array(hashBuffer))

  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

async function uploadObject(token: UploadToken, file: File) {
  if (token.method === 'POST') {
    const form = new FormData()

    for (const [key, value] of Object.entries(token.fields || {})) {
      form.append(key, value)
    }
    form.append('file', file)

    return fetch(token.uploadUrl, {
      method: 'POST',
      body: form
    })
  }

  return fetch(token.uploadUrl, {
    method: token.method,
    headers: token.headers,
    body: file
  })
}

function openEditModal() {
  if (!version.value) {
    return
  }

  editForm.version = version.value.version
  editForm.channel = version.value.channel
  editForm.environment = version.value.environment
  editForm.visibility = version.value.visibility
  editForm.releaseNotes = version.value.releaseNotes || ''
  editError.value = ''
  editOpen.value = true
}

async function refreshPage() {
  await refresh()
  toast.add({
    title: '页面已刷新',
    color: 'success',
    icon: 'i-lucide-refresh-cw'
  })
}

async function saveVersion() {
  editError.value = ''
  saving.value = true

  try {
    await $fetch(`/api/file-versions/${versionId.value}`, {
      method: 'PATCH',
      body: editForm
    })
    toast.add({
      title: '文件版本已更新',
      color: 'success'
    })
    editOpen.value = false
    await refresh()
  } catch (error) {
    editError.value = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : '更新文件版本失败'
  } finally {
    saving.value = false
  }
}

async function publishVersion() {
  publishing.value = true

  try {
    await $fetch(`/api/file-versions/${versionId.value}/publish`, {
      method: 'POST'
    })
    toast.add({
      title: '文件版本已发布',
      color: 'success'
    })
    await refresh()
  } catch (error) {
    toast.add({
      title: error && typeof error === 'object' && 'statusMessage' in error
        ? String(error.statusMessage)
        : '发布失败',
      color: 'error'
    })
  } finally {
    publishing.value = false
  }
}

async function revokeVersion() {
  revoking.value = true

  try {
    await $fetch(`/api/file-versions/${versionId.value}/revoke`, {
      method: 'POST'
    })
    toast.add({
      title: '文件版本已撤回',
      color: 'success'
    })
    await refresh()
  } finally {
    revoking.value = false
  }
}

async function rollbackVersion() {
  rollingBack.value = true

  try {
    await $fetch(`/api/file-versions/${versionId.value}/rollback`, {
      method: 'POST'
    })
    toast.add({
      title: '已回滚到当前文件版本',
      color: 'success'
    })
    await refresh()
  } catch (error) {
    toast.add({
      title: error && typeof error === 'object' && 'statusMessage' in error
        ? String(error.statusMessage)
        : '回滚失败',
      color: 'error'
    })
  } finally {
    rollingBack.value = false
  }
}

async function uploadFile() {
  if (!uploadForm.storageConfigId) {
    uploadError.value = '请先选择已验证的存储配置'
    return
  }

  if (!selectedFile.value) {
    uploadError.value = '请选择文件'
    return
  }

  uploadError.value = ''
  uploading.value = true

  try {
    const file = selectedFile.value
    const contentType = file.type || 'application/octet-stream'
    const token = await $fetch<UploadToken>(`/api/file-versions/${versionId.value}/upload-token`, {
      method: 'POST',
      body: {
        storageConfigId: uploadForm.storageConfigId,
        fileName: file.name,
        contentType
      }
    })
    const response = await uploadObject(token, file)

    if (!response.ok) {
      throw new Error(`Object storage upload failed with ${response.status}`)
    }

    await $fetch(`/api/file-versions/${versionId.value}/complete`, {
      method: 'POST',
      body: {
        storageConfigId: token.storageConfigId,
        fileName: file.name,
        objectKey: token.objectKey,
        bucket: token.bucket,
        endpoint: token.endpoint,
        size: file.size,
        sha256: await digestFile(file),
        mimeType: contentType
      }
    })

    toast.add({
      title: '文件已上传',
      color: 'success'
    })
    selectedFile.value = null
    uploadOpen.value = false
    await refresh()
  } catch (error) {
    uploadError.value = error instanceof Error
      ? error.message
      : '上传失败，请检查存储配置'
  } finally {
    uploading.value = false
  }
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
            :to="`/files/${version?.fileProjectId}`"
            label="返回文件项目"
            class="-ml-3 mb-1"
          />
          <h1 class="text-2xl font-semibold">
            文件版本 {{ version?.version || '' }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ version?.project.name }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            label="刷新"
            @click="refreshPage"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-pencil"
            label="修改"
            @click="openEditModal"
          />
          <UButton
            v-if="version?.status !== 'published'"
            color="success"
            variant="outline"
            icon="i-lucide-send"
            label="发布"
            :disabled="!version?.size"
            :loading="publishing"
            @click="publishVersion"
          />
          <UButton
            v-else
            color="neutral"
            variant="outline"
            icon="i-lucide-rotate-ccw"
            label="回滚到此版本"
            :loading="rollingBack"
            @click="rollbackVersion"
          />
          <UButton
            v-if="version?.status !== 'revoked'"
            color="warning"
            variant="outline"
            icon="i-lucide-undo-2"
            label="撤回"
            :loading="revoking"
            @click="revokeVersion"
          />
        </div>
      </div>
    </section>

    <section class="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-6">
        <UCard>
          <template #header>
            <div>
              <h2 class="text-base font-semibold">
                版本信息
              </h2>
              <p class="mt-1 text-sm text-muted">
                上传文件后可继续编辑版本信息，并通过发布流程对外提供更新。
              </p>
            </div>
          </template>

          <div class="grid gap-4 text-sm lg:grid-cols-2">
            <div>
              <p class="text-muted">
                版本号
              </p>
              <p class="mt-1 font-medium">
                {{ version?.version || '-' }}
              </p>
            </div>

            <div>
              <p class="text-muted">
                目标
              </p>
              <UBadge
                class="mt-1"
                color="neutral"
                variant="subtle"
                :label="`${version?.channel || '-'} / ${version?.environment || '-'}`"
              />
            </div>

            <div>
              <p class="text-muted">
                可见性
              </p>
              <UBadge
                class="mt-1"
                color="neutral"
                variant="subtle"
                :label="visibilityLabel(version?.visibility || 'signed')"
              />
            </div>

            <div>
              <p class="text-muted">
                发布时间
              </p>
              <p class="mt-1">
                {{ version?.publishedAt ? new Date(version.publishedAt).toLocaleString() : '-' }}
              </p>
            </div>

            <div class="lg:col-span-2">
              <p class="text-muted">
                更新说明
              </p>
              <p class="mt-1 whitespace-pre-wrap">
                {{ version?.releaseNotes || '-' }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="text-base font-semibold">
                  文件
                </h2>
                <p class="mt-1 text-sm text-muted">
                  保存普通文件本体、大小、哈希和对象存储路径。
                </p>
              </div>

              <div class="flex gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-refresh-cw"
                  label="刷新"
                  @click="refresh"
                />
                <UButton
                  icon="i-lucide-upload"
                  label="上传文件"
                  @click="uploadOpen = true"
                />
              </div>
            </div>
          </template>

          <div class="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <p class="text-muted">
                文件名
              </p>
              <p class="mt-1 font-medium">
                {{ version?.fileName || '未上传' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                大小
              </p>
              <p class="mt-1">
                {{ formatFileSize(version?.size || 0) }}
              </p>
            </div>
            <div class="md:col-span-2">
              <p class="text-muted">
                Object Key
              </p>
              <code class="mt-1 block break-all rounded bg-elevated px-2 py-1 text-xs">
                {{ version?.objectKey || '-' }}
              </code>
            </div>
            <div class="md:col-span-2">
              <p class="text-muted">
                SHA-256
              </p>
              <code class="mt-1 block break-all rounded bg-elevated px-2 py-1 text-xs">
                {{ version?.sha256 || '-' }}
              </code>
            </div>
          </div>
        </UCard>
      </div>

      <aside class="space-y-4">
        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">
              状态
            </h2>
          </template>

          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-muted">发布状态</span>
              <UBadge
                :color="statusColor(version?.status || 'draft')"
                variant="subtle"
                :label="statusLabel(version?.status || 'draft')"
              />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">目标</span>
              <UBadge
                color="neutral"
                variant="subtle"
                :label="`${version?.channel || '-'} / ${version?.environment || '-'}`"
              />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">可见性</span>
              <UBadge color="neutral" variant="subtle" :label="visibilityLabel(version?.visibility || 'signed')" />
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">
              对象存储直传
            </h2>
          </template>

          <p class="text-sm text-muted">
            上传会先向服务端申请短期 PUT 签名 URL，再由浏览器直接上传到已验证的对象存储配置。
          </p>
        </UCard>
      </aside>
    </section>

    <UModal
      v-model:open="editOpen"
      title="修改文件版本"
      description="变更普通文件版本的基础信息。公开分享页只展示已发布且可见性为公开分享的版本。"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <form id="edit-file-version-form" class="grid gap-4" @submit.prevent="saveVersion">
          <UAlert
            v-if="editError"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="editError"
          />

          <UFormField label="版本号" name="version" required>
            <UInput v-model="editForm.version" class="w-full" placeholder="1.0.0" />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Channel" name="channel" required>
              <UInput v-model="editForm.channel" class="w-full" placeholder="stable" />
            </UFormField>

            <UFormField label="Environment" name="environment" required>
              <UInput v-model="editForm.environment" class="w-full" placeholder="prod" />
            </UFormField>
          </div>

          <UFormField
            label="可见性"
            name="visibility"
            description="签名访问用于检查更新和下载接口；公开分享允许公开分享页展示并下载。"
            required
          >
            <USelect v-model="editForm.visibility" class="w-full" :items="visibilityItems" />
          </UFormField>

          <UFormField label="更新说明" name="releaseNotes">
            <UTextarea v-model="editForm.releaseNotes" class="w-full" :rows="4" />
          </UFormField>
        </form>
      </template>

      <template #footer="{ close }">
        <UButton
          color="neutral"
          variant="outline"
          label="取消"
          :disabled="saving"
          @click="close"
        />
        <UButton
          type="submit"
          form="edit-file-version-form"
          icon="i-lucide-save"
          label="保存"
          :loading="saving"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="uploadOpen"
      title="上传普通文件"
      description="选择已验证的存储配置后，将文件直传到对象存储。"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <form id="upload-file-version-form" class="grid gap-4" @submit.prevent="uploadFile">
          <UAlert
            v-if="uploadError"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="uploadError"
          />

          <UAlert
            v-if="storageConfigItems.length === 0"
            color="warning"
            variant="soft"
            icon="i-lucide-triangle-alert"
            title="暂无可用存储配置"
            description="请先到存储配置页面新增并验证对象存储。"
          />

          <UFormField label="存储配置" name="storageConfigId" required>
            <USelect
              v-model="uploadForm.storageConfigId"
              class="w-full"
              :items="storageConfigItems"
              placeholder="选择已验证的对象存储配置"
            />
          </UFormField>

          <UFormField label="文件" name="file" required>
            <input
              class="block w-full rounded-md border border-muted bg-default px-3 py-2 text-sm"
              type="file"
              @change="onFileChange"
            >
          </UFormField>

          <UAlert
            v-if="selectedFile"
            color="neutral"
            variant="soft"
            icon="i-lucide-file"
            :title="selectedFile.name"
            :description="formatFileSize(selectedFile.size)"
          />
        </form>
      </template>

      <template #footer="{ close }">
        <UButton
          color="neutral"
          variant="outline"
          label="取消"
          :disabled="uploading"
          @click="close"
        />
        <UButton
          type="submit"
          form="upload-file-version-form"
          icon="i-lucide-upload"
          label="上传"
          :disabled="storageConfigItems.length === 0"
          :loading="uploading"
        />
      </template>
    </UModal>
  </main>
</template>
