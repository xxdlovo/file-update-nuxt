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
  method: 'PUT' | 'POST'
  uploadUrl: string
  objectKey: string
  storageConfigId: number | null
  bucket: string
  endpoint?: string
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
const revoking = ref(false)
const publishing = ref(false)
const rollingBack = ref(false)
const uploading = ref(false)
const uploadOpen = ref(false)
const deleteFileOpen = ref(false)
const deletingFile = ref(false)
const deleteFileObject = ref(false)
const uploadError = ref('')
const selectedFile = ref<File | null>(null)
const pendingDeleteFile = ref<UpdateFile | null>(null)

const { data: version, refresh } = useLazyFetch<VersionDetail>(() => `/api/versions/${versionId.value}`)
const { data: filesData, refresh: refreshFiles } = useLazyFetch<{ items: UpdateFile[], total: number }>(
  () => `/api/versions/${versionId.value}/files`
)
const { data: storageConfigsData } = useLazyFetch<{ items: StorageConfigOption[], total: number }>(
  '/api/storage-configs?verified=true'
)

const uploadForm = reactive({
  storageConfigId: null as number | null,
  platform: 'win32',
  arch: 'x64',
  packageType: 'full'
})

const files = computed(() => filesData.value?.items || [])
const storageConfigs = computed(() => storageConfigsData.value?.items || [])
const storageConfigItems = computed(() => storageConfigs.value.map(config => ({
  label: `${config.name} / ${providerLabel(config.provider)} / ${config.bucket}`,
  value: config.id
})))
const platformItems = ['win32', 'darwin', 'linux']
const archItems = ['x64', 'arm64']
const packageTypeItems = ['full', 'delta', 'blockmap', 'metadata']

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

async function refreshPage() {
  await Promise.all([
    refresh(),
    refreshFiles()
  ])
  toast.add({
    title: '页面已刷新',
    color: 'success',
    icon: 'i-lucide-refresh-cw'
  })
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

    const response = await uploadObject(token, file)

    if (!response.ok) {
      throw new Error(`Object storage upload failed with ${response.status}`)
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
      : '上传失败，请检查对象存储配置'
  } finally {
    uploading.value = false
  }
}

function openDeleteFile(file: UpdateFile) {
  pendingDeleteFile.value = file
  deleteFileObject.value = false
  deleteFileOpen.value = true
}

async function deleteFile() {
  if (!pendingDeleteFile.value) {
    return
  }

  deletingFile.value = true

  try {
    await $fetch(`/api/update-files/${pendingDeleteFile.value.id}`, {
      method: 'DELETE',
      body: {
        deleteObject: deleteFileObject.value,
        confirmObjectKey: deleteFileObject.value ? pendingDeleteFile.value.objectKey : ''
      }
    })
    toast.add({
      title: '文件记录已删除',
      color: 'success'
    })
    deleteFileOpen.value = false
    pendingDeleteFile.value = null
    deleteFileObject.value = false
    await refreshFiles()
  } finally {
    deletingFile.value = false
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
            icon="i-lucide-refresh-cw"
            label="刷新"
            @click="refreshPage"
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
                构建号
              </p>
              <p class="mt-1">
                {{ version?.buildNumber || '-' }}
              </p>
            </div>

            <div>
              <p class="text-muted">
                通道
              </p>
              <UBadge class="mt-1" color="neutral" variant="subtle" :label="version?.channel || '-'" />
            </div>

            <div>
              <p class="text-muted">
                强制更新
              </p>
              <p class="mt-1">
                {{ version?.forceUpdate ? '是' : '否' }}
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
                  升级文件
                </h2>
                <p class="mt-1 text-sm text-muted">
                  管理全量包、增量包、blockmap 和元数据文件。
                </p>
              </div>

              <div class="flex gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-refresh-cw"
                  label="刷新"
                  @click="refreshFiles"
                />
                <UButton
                  icon="i-lucide-upload"
                  label="上传文件"
                  @click="uploadOpen = true"
                />
              </div>
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
                          @click="openDeleteFile(file)"
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
              对象存储直传
            </h2>
          </template>

          <p class="text-sm text-muted">
            上传会先向服务端申请短期上传凭证，再由浏览器直接上传到已验证的对象存储。
          </p>
        </UCard>
      </aside>
    </section>

    <UModal
      v-model:open="uploadOpen"
      title="上传升级文件"
      description="选择目标平台、架构和包类型后，将文件直传到已验证的对象存储。"
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

    <UModal
      v-model:open="deleteFileOpen"
      title="删除升级文件记录"
      description="默认只删除数据库记录，勾选后会同步删除对象存储中的文件。"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :title="`确认删除 ${pendingDeleteFile?.fileName || ''}？`"
            :description="pendingDeleteFile?.objectKey || '删除后可重新上传文件记录。'"
          />

          <UCheckbox
            v-model="deleteFileObject"
            :disabled="!pendingDeleteFile?.objectKey"
            label="同时删除对象存储中的文件"
          />
        </div>
      </template>

      <template #footer="{ close }">
        <UButton
          color="neutral"
          variant="outline"
          label="取消"
          :disabled="deletingFile"
          @click="close"
        />
        <UButton
          color="error"
          icon="i-lucide-trash"
          label="删除记录"
          :loading="deletingFile"
          @click="deleteFile"
        />
      </template>
    </UModal>
  </main>
</template>
