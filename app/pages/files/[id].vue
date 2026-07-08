<script setup lang="ts">
type FileProjectDetail = {
  id: number
  name: string
  slug: string
  category: string | null
  defaultChannel: string
  enabled: boolean
  description: string | null
}

type FileVersionItem = {
  id: number
  fileProjectId: number
  version: string
  channel: string
  environment: string
  status: string
  releaseNotes: string | null
  fileName: string
  size: number
  sha256: string | null
  visibility: string
  publishedAt: string | null
}

const route = useRoute()
const toast = useToast()
const requestUrl = useRequestURL()
const projectId = computed(() => String(route.params.id))
const savingVersion = ref(false)
const versionModalOpen = ref(false)
const deleteVersionOpen = ref(false)
const deletingVersion = ref(false)
const versionError = ref('')
const editingVersion = ref<FileVersionItem | null>(null)
const pendingDeleteVersion = ref<FileVersionItem | null>(null)
const deleteVersionObject = ref(false)
const endpointForm = reactive({
  channel: 'stable',
  environment: 'prod',
  version: ''
})

const versionForm = reactive({
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

const { data: project, refresh } = useLazyFetch<FileProjectDetail>(() => `/api/files/${projectId.value}`)
const { data: versionsData, refresh: refreshVersions } = useLazyFetch<{ items: FileVersionItem[], total: number }>(
  () => `/api/files/${projectId.value}/versions`
)

const versions = computed(() => versionsData.value?.items || [])
const channelItems = computed(() => {
  const channels = new Set<string>()

  if (project.value?.defaultChannel) {
    channels.add(project.value.defaultChannel)
  }

  for (const version of versions.value) {
    channels.add(version.channel)
  }

  channels.add(endpointForm.channel)

  return Array.from(channels).filter(Boolean)
})
const environmentItems = computed(() => {
  const environments = new Set<string>(['prod'])

  for (const version of versions.value) {
    environments.add(version.environment)
  }

  environments.add(endpointForm.environment)

  return Array.from(environments).filter(Boolean)
})
const origin = computed(() => {
  if (import.meta.client) {
    return window.location.origin
  }

  return requestUrl.origin
})
const checkUpdateUrl = computed(() => {
  if (!project.value?.slug || !origin.value) {
    return ''
  }

  const url = new URL(`/api/public/files/${encodeURIComponent(project.value.slug)}/check-update`, origin.value)

  url.searchParams.set('channel', endpointForm.channel)
  url.searchParams.set('env', endpointForm.environment)

  if (endpointForm.version.trim()) {
    url.searchParams.set('version', endpointForm.version.trim())
  }

  return url.toString()
})
const latestUrl = computed(() => {
  if (!project.value?.slug || !origin.value) {
    return ''
  }

  const url = new URL(`/api/public/files/${encodeURIComponent(project.value.slug)}/latest`, origin.value)

  url.searchParams.set('channel', endpointForm.channel)
  url.searchParams.set('env', endpointForm.environment)

  return url.toString()
})
const downloadUrl = computed(() => {
  if (!project.value?.slug || !origin.value) {
    return ''
  }

  const url = new URL(`/api/public/files/${encodeURIComponent(project.value.slug)}/download`, origin.value)

  url.searchParams.set('channel', endpointForm.channel)
  url.searchParams.set('env', endpointForm.environment)

  return url.toString()
})
const shareUrl = computed(() => {
  if (!project.value?.slug || !origin.value) {
    return ''
  }

  const url = new URL(`/share/files/${encodeURIComponent(project.value.slug)}`, origin.value)

  url.searchParams.set('channel', endpointForm.channel)
  url.searchParams.set('env', endpointForm.environment)

  return url.toString()
})

watch(project, (value) => {
  if (!value) {
    return
  }

  if (!versionModalOpen.value || !editingVersion.value) {
    versionForm.channel = value.defaultChannel
  }
  endpointForm.channel = value.defaultChannel
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

function resetVersionForm() {
  versionForm.version = ''
  versionForm.channel = project.value?.defaultChannel || 'stable'
  versionForm.environment = 'prod'
  versionForm.visibility = 'signed'
  versionForm.releaseNotes = ''
  versionError.value = ''
}

function openCreateVersionModal() {
  editingVersion.value = null
  resetVersionForm()
  versionModalOpen.value = true
}

function openEditVersionModal(version: FileVersionItem) {
  editingVersion.value = version
  versionForm.version = version.version
  versionForm.channel = version.channel
  versionForm.environment = version.environment
  versionForm.visibility = version.visibility
  versionForm.releaseNotes = version.releaseNotes || ''
  versionError.value = ''
  versionModalOpen.value = true
}

async function refreshPage() {
  await Promise.all([
    refresh(),
    refreshVersions()
  ])
  toast.add({
    title: '页面已刷新',
    color: 'success',
    icon: 'i-lucide-refresh-cw'
  })
}

async function submitVersion() {
  versionError.value = ''
  savingVersion.value = true
  const isEditing = Boolean(editingVersion.value)

  try {
    const saved = await $fetch<FileVersionItem>(
      editingVersion.value
        ? `/api/file-versions/${editingVersion.value.id}`
        : `/api/files/${projectId.value}/versions`,
      {
        method: editingVersion.value ? 'PATCH' : 'POST',
        body: versionForm
      }
    )

    toast.add({
      title: editingVersion.value ? '文件版本已更新' : '文件版本已创建',
      color: 'success'
    })
    versionModalOpen.value = false
    editingVersion.value = null
    resetVersionForm()
    await refreshVersions()

    if (!isEditing && saved?.id) {
      await navigateTo(`/file-versions/${saved.id}`)
    }
  } catch (error) {
    versionError.value = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : editingVersion.value ? '更新版本失败' : '创建版本失败'
  } finally {
    savingVersion.value = false
  }
}

function openDeleteVersion(version: FileVersionItem) {
  pendingDeleteVersion.value = version
  deleteVersionObject.value = false
  deleteVersionOpen.value = true
}

async function deleteVersion() {
  if (!pendingDeleteVersion.value) {
    return
  }

  deletingVersion.value = true

  try {
    await $fetch(`/api/file-versions/${pendingDeleteVersion.value.id}`, {
      method: 'DELETE',
      body: {
        deleteObject: deleteVersionObject.value,
        confirmObjectKey: deleteVersionObject.value ? pendingDeleteVersion.value.objectKey : ''
      }
    })
    toast.add({
      title: '文件版本已删除',
      color: 'success'
    })
    deleteVersionOpen.value = false
    pendingDeleteVersion.value = null
    deleteVersionObject.value = false
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
            to="/files"
            label="返回文件项目"
            class="-ml-3 mb-1"
          />
          <h1 class="text-2xl font-semibold">
            {{ project?.name || '文件项目详情' }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ project?.slug }}
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
                这些信息会用于普通文件版本发布和检查更新接口。
              </p>
            </div>
          </template>

          <div class="grid gap-4 text-sm lg:grid-cols-2">
            <div>
              <p class="text-muted">
                项目名称
              </p>
              <p class="mt-1 font-medium">
                {{ project?.name || '-' }}
              </p>
            </div>

            <div>
              <p class="text-muted">
                Slug
              </p>
              <code class="mt-1 block break-all rounded bg-elevated px-2 py-1 text-xs">
                {{ project?.slug || '-' }}
              </code>
            </div>

            <div>
              <p class="text-muted">
                分类
              </p>
              <p class="mt-1">
                {{ project?.category || '-' }}
              </p>
            </div>

            <div>
              <p class="text-muted">
                默认通道
              </p>
              <UBadge class="mt-1" color="neutral" variant="subtle" :label="project?.defaultChannel || '-'" />
            </div>

            <div class="lg:col-span-2">
              <p class="text-muted">
                描述
              </p>
              <p class="mt-1 whitespace-pre-wrap">
                {{ project?.description || '-' }}
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
                  管理普通文件版本、上传文件并进入发布流程。
                </p>
              </div>

              <UButton
                icon="i-lucide-plus"
                label="创建版本"
                @click="openCreateVersionModal"
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
                    目标
                  </th>
                  <th class="px-4 py-3 font-medium">
                    可见性
                  </th>
                  <th class="px-4 py-3 font-medium">
                    文件
                  </th>
                  <th class="px-4 py-3 font-medium">
                    状态
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="versions.length === 0">
                  <td class="px-4 py-8 text-center text-muted" colspan="6">
                    暂无普通文件版本
                  </td>
                </tr>
                <template v-else>
                  <tr
                    v-for="version in versions"
                    :key="version.id"
                    class="border-b border-muted last:border-b-0"
                  >
                    <td class="px-4 py-3">
                      <NuxtLink :to="`/file-versions/${version.id}`" class="font-medium text-highlighted">
                        {{ version.version }}
                      </NuxtLink>
                    </td>
                    <td class="px-4 py-3">
                      <UBadge color="neutral" variant="subtle" :label="`${version.channel} / ${version.environment}`" />
                    </td>
                    <td class="px-4 py-3">
                      <UBadge
                        color="neutral"
                        variant="subtle"
                        :label="visibilityLabel(version.visibility)"
                      />
                    </td>
                    <td class="px-4 py-3">
                      <p>{{ version.fileName || '未上传' }}</p>
                      <p class="text-xs text-muted">
                        {{ formatFileSize(version.size) }}
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      <UBadge
                        :color="statusColor(version.status)"
                        variant="subtle"
                        :label="statusLabel(version.status)"
                      />
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex justify-end gap-2">
                        <UButton
                          color="neutral"
                          variant="ghost"
                          icon="i-lucide-eye"
                          :to="`/file-versions/${version.id}`"
                          aria-label="详情"
                        />
                        <UButton
                          color="neutral"
                          variant="ghost"
                          icon="i-lucide-pencil"
                          aria-label="修改"
                          @click="openEditVersionModal(version)"
                        />
                        <UButton
                          color="error"
                          variant="ghost"
                          icon="i-lucide-trash"
                          aria-label="删除文件版本"
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
              <span class="text-muted">启用状态</span>
              <UBadge
                :color="project?.enabled ? 'success' : 'neutral'"
                variant="subtle"
                :label="project?.enabled ? '启用' : '停用'"
              />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">默认通道</span>
              <UBadge color="neutral" variant="subtle" :label="project?.defaultChannel || '-'" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">分类</span>
              <span>{{ project?.category || '-' }}</span>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div>
              <h2 class="text-base font-semibold">
                检查更新
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

              <UFormField label="Environment" name="endpointEnvironment">
                <USelect v-model="endpointForm.environment" class="w-full" :items="environmentItems" />
              </UFormField>

              <UFormField label="当前版本" name="endpointVersion" hint="可选">
                <UInput v-model="endpointForm.version" class="w-full" placeholder="1.0.0" />
              </UFormField>
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
                  当前版本
                </p>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-copy"
                  aria-label="复制当前版本 URL"
                  :disabled="!latestUrl"
                  @click="copyText(latestUrl, '当前版本 URL')"
                />
              </div>
              <code class="block break-all rounded bg-elevated px-2 py-1 text-xs">
                {{ latestUrl || '-' }}
              </code>
            </div>

            <div>
              <div class="mb-1 flex items-center justify-between gap-2">
                <p class="text-muted">
                  下载地址
                </p>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-copy"
                  aria-label="复制下载地址 URL"
                  :disabled="!downloadUrl"
                  @click="copyText(downloadUrl, '下载地址 URL')"
                />
              </div>
              <code class="block break-all rounded bg-elevated px-2 py-1 text-xs">
                {{ downloadUrl || '-' }}
              </code>
            </div>

            <div>
              <div class="mb-1 flex items-center justify-between gap-2">
                <p class="text-muted">
                  公开分享页
                </p>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-copy"
                  aria-label="复制公开分享页 URL"
                  :disabled="!shareUrl"
                  @click="copyText(shareUrl, '公开分享页 URL')"
                />
              </div>
              <code class="block break-all rounded bg-elevated px-2 py-1 text-xs">
                {{ shareUrl || '-' }}
              </code>
              <p class="mt-1 text-xs text-muted">
                分享页仅展示已发布且可见性为 public 的普通文件版本。
              </p>
            </div>
          </div>
        </UCard>
      </aside>
    </section>

    <UModal
      v-model:open="versionModalOpen"
      :title="editingVersion ? '修改文件版本' : '创建文件版本'"
      :description="editingVersion ? '变更普通文件版本的基础信息。' : '创建普通文件版本草稿，随后可上传文件并发布。'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <form id="file-version-form" class="grid gap-4" @submit.prevent="submitVersion">
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

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Channel" name="channel" required>
              <UInput v-model="versionForm.channel" class="w-full" placeholder="stable" />
            </UFormField>

            <UFormField label="Environment" name="environment" required>
              <UInput v-model="versionForm.environment" class="w-full" placeholder="prod" />
            </UFormField>
          </div>

          <UFormField
            label="可见性"
            name="visibility"
            description="签名访问用于检查更新和下载接口；公开分享允许公开分享页展示并下载。"
            required
          >
            <USelect v-model="versionForm.visibility" class="w-full" :items="visibilityItems" />
          </UFormField>

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
          form="file-version-form"
          icon="i-lucide-save"
          label="保存"
          :loading="savingVersion"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="deleteVersionOpen"
      title="删除文件版本"
      description="删除后会移除该文件版本的数据库记录和发布指针。"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :title="`确认删除文件版本 ${pendingDeleteVersion?.version || ''}？`"
            description="此操作会删除文件版本记录和发布指针。"
          />

          <UCheckbox
            v-model="deleteVersionObject"
            :disabled="!pendingDeleteVersion?.fileName || !pendingDeleteVersion?.objectKey || !pendingDeleteVersion?.size"
            label="同时删除对象存储中的文件"
          />

          <div v-if="pendingDeleteVersion?.fileName && pendingDeleteVersion?.objectKey && pendingDeleteVersion?.size" class="space-y-2">
            <p class="text-sm text-muted">
              将删除以下对象：
            </p>
            <code class="block max-h-40 overflow-auto break-all rounded bg-elevated px-3 py-2 text-xs">
              {{ pendingDeleteVersion.objectKey }}
            </code>
          </div>

          <p v-else class="text-sm text-muted">
            该版本尚未上传文件。
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
