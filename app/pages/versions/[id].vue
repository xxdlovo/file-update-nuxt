<script setup lang="ts">
type VersionDetail = {
  id: number
  appId: number
  version: string
  buildNumber: string | null
  channel: string
  status: string
  forceUpdate: boolean
  releaseNotes: string | null
  publishedAt: string | null
  app: {
    id: number
    name: string
    slug: string
    defaultChannel: string
  }
}

type UpdateFile = {
  id: number
  platform: string
  arch: string
  packageType: string
  fileName: string
  objectKey: string
  size: number
  sha256: string | null
  sha512: string | null
  mimeType: string | null
}

type UploadToken = {
  method: 'PUT'
  uploadUrl: string
  objectKey: string
  storageConfigId: number | null
  bucket: string
  endpoint?: string
  headers: Record<string, string>
}

type StorageConfigOption = {
  id: number
  name: string
  bucket: string
  region: string
}

const route = useRoute()
const toast = useToast()
const versionId = computed(() => String(route.params.id))
const saving = ref(false)
const revoking = ref(false)
const publishing = ref(false)
const rollingBack = ref(false)
const uploading = ref(false)
const uploadOpen = ref(false)
const errorMessage = ref('')
const uploadError = ref('')
const selectedFile = ref<File | null>(null)

const { data: version, refresh } = await useFetch<VersionDetail>(() => `/api/versions/${versionId.value}`)
const { data: filesData, refresh: refreshFiles } = await useFetch<{ items: UpdateFile[], total: number }>(
  () => `/api/versions/${versionId.value}/files`
)
const { data: storageConfigsData } = await useFetch<{ items: StorageConfigOption[], total: number }>(
  '/api/storage-configs?verified=true'
)

const form = reactive({
  version: '',
  buildNumber: '',
  channel: 'latest',
  forceUpdate: false,
  releaseNotes: ''
})

const uploadForm = reactive({
  storageConfigId: null as number | null,
  platform: 'win32',
  arch: 'x64',
  packageType: 'full'
})

const files = computed(() => filesData.value?.items || [])
const storageConfigs = computed(() => storageConfigsData.value?.items || [])
const storageConfigItems = computed(() => storageConfigs.value.map(config => ({
  label: `${config.name} / ${config.bucket}`,
  value: config.id
})))
const platformItems = ['win32', 'darwin', 'linux']
const archItems = ['x64', 'arm64']
const packageTypeItems = ['full', 'delta', 'blockmap', 'metadata']

watch(version, (value) => {
  if (!value) {
    return
  }

  form.version = value.version
  form.buildNumber = value.buildNumber || ''
  form.channel = value.channel
  form.forceUpdate = value.forceUpdate
  form.releaseNotes = value.releaseNotes || ''
}, { immediate: true })

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

function formatFileSize(size: number) {
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

async function digestFile(file: File, algorithm: 'SHA-256' | 'SHA-512') {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest(algorithm, buffer)
  const bytes = Array.from(new Uint8Array(hashBuffer))

  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

async function saveVersion() {
  errorMessage.value = ''
  saving.value = true

  try {
    await $fetch(`/api/versions/${versionId.value}`, {
      method: 'PATCH',
      body: form
    })
    toast.add({
      title: '版本已保存',
      color: 'success'
    })
    await refresh()
  } catch (error) {
    errorMessage.value = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : '保存失败'
  } finally {
    saving.value = false
  }
}

async function revokeVersion() {
  revoking.value = true

  try {
    await $fetch(`/api/versions/${versionId.value}/revoke`, {
      method: 'POST'
    })
    toast.add({
      title: '版本已撤回',
      color: 'success'
    })
    await refresh()
  } finally {
    revoking.value = false
  }
}

async function publishVersion() {
  publishing.value = true

  try {
    await $fetch(`/api/versions/${versionId.value}/publish`, {
      method: 'POST'
    })
    toast.add({
      title: '版本已发布',
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

async function rollbackVersion() {
  rollingBack.value = true

  try {
    await $fetch(`/api/versions/${versionId.value}/rollback`, {
      method: 'POST'
    })
    toast.add({
      title: '已回滚到当前版本',
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
    const token = await $fetch<UploadToken>('/api/update-files/upload-token', {
      method: 'POST',
      body: {
        versionId: Number(versionId.value),
        storageConfigId: uploadForm.storageConfigId,
        fileName: file.name,
        platform: uploadForm.platform,
        arch: uploadForm.arch,
        packageType: uploadForm.packageType,
        contentType
      }
    })

    const response = await fetch(token.uploadUrl, {
      method: token.method,
      headers: token.headers,
      body: file
    })

    if (!response.ok) {
      throw new Error(`OSS upload failed with ${response.status}`)
    }

    const [sha256, sha512] = await Promise.all([
      digestFile(file, 'SHA-256'),
      digestFile(file, 'SHA-512')
    ])

    await $fetch('/api/update-files/complete', {
      method: 'POST',
      body: {
        versionId: Number(versionId.value),
        platform: uploadForm.platform,
        arch: uploadForm.arch,
        packageType: uploadForm.packageType,
        fileName: file.name,
        objectKey: token.objectKey,
        storageConfigId: token.storageConfigId,
        bucket: token.bucket,
        endpoint: token.endpoint,
        size: file.size,
        sha256,
        sha512,
        mimeType: contentType
      }
    })

    toast.add({
      title: '文件已上传',
      color: 'success'
    })
    selectedFile.value = null
    uploadOpen.value = false
    await refreshFiles()
  } catch (error) {
    uploadError.value = error instanceof Error
      ? error.message
      : '上传失败，请检查 OSS 配置'
  } finally {
    uploading.value = false
  }
}

async function deleteFile(file: UpdateFile) {
  await $fetch(`/api/update-files/${file.id}`, {
    method: 'DELETE'
  })
  toast.add({
    title: '文件记录已删除',
    color: 'success'
  })
  await refreshFiles()
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
            :to="`/apps/${version?.appId}`"
            label="返回应用详情"
            class="-ml-3 mb-1"
          />
          <h1 class="text-2xl font-semibold">
            版本 {{ version?.version || '' }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ version?.app.name }}
          </p>
        </div>

        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-upload"
            label="上传文件"
            @click="uploadOpen = true"
          />
          <UButton
            v-if="version?.status !== 'published'"
            color="success"
            variant="outline"
            icon="i-lucide-send"
            label="发布"
            :disabled="files.length === 0"
            :loading="publishing"
            @click="publishVersion"
          />
          <UButton
            v-else
            color="neutral"
            variant="outline"
            icon="i-lucide-rotate-ccw"
            label="回滚到此版本"
            :disabled="files.length === 0"
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
          <UButton
            icon="i-lucide-save"
            label="保存"
            :loading="saving"
            @click="saveVersion"
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
                发布前可继续编辑版本信息，上传文件后即可进入发布流程。
              </p>
            </div>
          </template>

          <form class="grid gap-4 lg:grid-cols-2" @submit.prevent="saveVersion">
            <UAlert
              v-if="errorMessage"
              class="lg:col-span-2"
              color="error"
              variant="soft"
              icon="i-lucide-circle-alert"
              :title="errorMessage"
            />

            <UFormField
              label="版本号"
              name="version"
              description="MVP 阶段使用标准 semver，例如 1.2.0。"
              required
            >
              <UInput v-model="form.version" class="w-full" />
            </UFormField>

            <UFormField label="构建号" name="buildNumber">
              <UInput v-model="form.buildNumber" class="w-full" />
            </UFormField>

            <UFormField label="通道" name="channel" required>
              <UInput v-model="form.channel" class="w-full" />
            </UFormField>

            <div class="flex items-end">
              <USwitch v-model="form.forceUpdate" label="强制更新" />
            </div>

            <UFormField class="lg:col-span-2" label="更新说明" name="releaseNotes">
              <UTextarea v-model="form.releaseNotes" class="w-full" :rows="8" />
            </UFormField>
          </form>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="text-base font-semibold">
                  升级文件
                </h2>
                <p class="mt-1 text-sm text-muted">
                  管理全量包、增量包、blockmap 和元数据文件。
                </p>
              </div>

              <UButton
                icon="i-lucide-upload"
                label="上传文件"
                @click="uploadOpen = true"
              />
            </div>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-muted text-muted">
                <tr>
                  <th class="px-4 py-3 font-medium">
                    文件
                  </th>
                  <th class="px-4 py-3 font-medium">
                    目标
                  </th>
                  <th class="px-4 py-3 font-medium">
                    类型
                  </th>
                  <th class="px-4 py-3 font-medium">
                    大小
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="files.length === 0">
                  <td class="px-4 py-8 text-center text-muted" colspan="5">
                    暂无升级文件
                  </td>
                </tr>
                <template v-else>
                  <tr
                    v-for="file in files"
                    :key="file.id"
                    class="border-b border-muted last:border-b-0"
                  >
                    <td class="px-4 py-3">
                      <p class="font-medium">
                        {{ file.fileName }}
                      </p>
                      <p class="max-w-md truncate text-xs text-muted">
                        {{ file.objectKey }}
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      <UBadge color="neutral" variant="subtle" :label="`${file.platform} / ${file.arch}`" />
                    </td>
                    <td class="px-4 py-3">
                      <UBadge color="neutral" variant="subtle" :label="file.packageType" />
                    </td>
                    <td class="px-4 py-3 text-muted">
                      {{ formatFileSize(file.size) }}
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex justify-end">
                        <UButton
                          color="error"
                          variant="ghost"
                          icon="i-lucide-trash"
                          aria-label="删除文件记录"
                          @click="deleteFile(file)"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
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
              <span class="text-muted">通道</span>
              <UBadge color="neutral" variant="subtle" :label="version?.channel || '-'" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">强制更新</span>
              <span>{{ version?.forceUpdate ? '是' : '否' }}</span>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">
              OSS 直传
            </h2>
          </template>

          <p class="text-sm text-muted">
            上传会先向服务端申请短期 PUT 签名 URL，再由浏览器直接上传到阿里云 OSS。
          </p>
        </UCard>
      </aside>
    </section>

    <UModal
      v-model:open="uploadOpen"
      title="上传升级文件"
      description="选择目标平台、架构和包类型后，将文件直传到阿里云 OSS。"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <form id="upload-update-file-form" class="grid gap-4" @submit.prevent="uploadFile">
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
            description="请先到存储配置页面新增并验证阿里云 OSS。"
          />

          <UFormField label="存储配置" name="storageConfigId" required>
            <USelect
              v-model="uploadForm.storageConfigId"
              class="w-full"
              :items="storageConfigItems"
              placeholder="选择已验证的 OSS 配置"
            />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField label="平台" name="platform" required>
              <USelect v-model="uploadForm.platform" class="w-full" :items="platformItems" />
            </UFormField>

            <UFormField label="架构" name="arch" required>
              <USelect v-model="uploadForm.arch" class="w-full" :items="archItems" />
            </UFormField>

            <UFormField label="包类型" name="packageType" required>
              <USelect v-model="uploadForm.packageType" class="w-full" :items="packageTypeItems" />
            </UFormField>
          </div>

          <UFormField
            label="文件"
            name="file"
            description="建议上传 Electron 安装包、增量包、blockmap 或 latest.yml 元数据文件。"
            required
          >
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
          form="upload-update-file-form"
          icon="i-lucide-upload"
          label="上传"
          :disabled="storageConfigItems.length === 0"
          :loading="uploading"
        />
      </template>
    </UModal>
  </main>
</template>
