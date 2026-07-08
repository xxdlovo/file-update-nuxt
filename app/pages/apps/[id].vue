<script setup lang="ts">
type AppDetail = {
  id: number
  name: string
  slug: string
  bundleId: string
  defaultChannel: string
  enabled: boolean
  description: string | null
}

type AppVersion = {
  id: number
  appId: number
  version: string
  buildNumber: string | null
  channel: string
  status: string
  forceUpdate: boolean
  releaseNotes: string | null
  publishedAt: string | null
  updatedAt: string
}

const route = useRoute()
const toast = useToast()
const appId = computed(() => String(route.params.id))
const saving = ref(false)
const creatingVersion = ref(false)
const versionModalOpen = ref(false)
const errorMessage = ref('')
const versionError = ref('')
const endpointForm = reactive({
  channel: 'latest',
  platform: 'win32',
  arch: 'x64'
})

const { data: app, refresh } = await useFetch<AppDetail>(() => `/api/apps/${appId.value}`)
const { data: versionsData, refresh: refreshVersions } = await useFetch<{ items: AppVersion[], total: number }>(
  () => `/api/apps/${appId.value}/versions`
)

const form = reactive({
  name: '',
  slug: '',
  bundleId: '',
  defaultChannel: 'latest',
  enabled: true,
  description: ''
})

const versionForm = reactive({
  version: '',
  buildNumber: '',
  channel: '',
  forceUpdate: false,
  releaseNotes: ''
})

const versions = computed(() => versionsData.value?.items || [])
const channelItems = computed(() => {
  const channels = new Set<string>()

  if (app.value?.defaultChannel) {
    channels.add(app.value.defaultChannel)
  }

  for (const version of versions.value) {
    channels.add(version.channel)
  }

  channels.add(endpointForm.channel)

  return Array.from(channels).filter(Boolean)
})
const platformItems = ['win32', 'darwin', 'linux']
const archItems = ['x64', 'arm64']
const origin = computed(() => {
  if (import.meta.client) {
    return window.location.origin
  }

  return ''
})
const updaterMetadataFile = computed(() => {
  if (endpointForm.platform === 'darwin') {
    return 'latest-mac.yml'
  }

  if (endpointForm.platform === 'linux') {
    return 'latest-linux.yml'
  }

  return 'latest.yml'
})
const checkUpdateUrl = computed(() => {
  if (!app.value?.slug || !origin.value) {
    return ''
  }

  const url = new URL(`/api/public/apps/${encodeURIComponent(app.value.slug)}/check-update`, origin.value)

  url.searchParams.set('channel', endpointForm.channel)
  url.searchParams.set('platform', endpointForm.platform)
  url.searchParams.set('arch', endpointForm.arch)

  return url.toString()
})
const metadataUrl = computed(() => {
  if (!app.value?.slug || !origin.value) {
    return ''
  }

  const path = [
    '/updates',
    encodeURIComponent(app.value.slug),
    encodeURIComponent(endpointForm.platform),
    encodeURIComponent(endpointForm.channel),
    updaterMetadataFile.value
  ].join('/')
  const url = new URL(path, origin.value)

  url.searchParams.set('arch', endpointForm.arch)

  return url.toString()
})

watch(app, (value) => {
  if (!value) {
    return
  }

  form.name = value.name
  form.slug = value.slug
  form.bundleId = value.bundleId
  form.defaultChannel = value.defaultChannel
  form.enabled = value.enabled
  form.description = value.description || ''
  versionForm.channel = value.defaultChannel
  endpointForm.channel = value.defaultChannel
}, { immediate: true })

function resetVersionForm() {
  versionForm.version = ''
  versionForm.buildNumber = ''
  versionForm.channel = app.value?.defaultChannel || 'latest'
  versionForm.forceUpdate = false
  versionForm.releaseNotes = ''
  versionError.value = ''
}

function openVersionModal() {
  resetVersionForm()
  versionModalOpen.value = true
}

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

async function saveApp() {
  errorMessage.value = ''
  saving.value = true

  try {
    await $fetch(`/api/apps/${appId.value}`, {
      method: 'PATCH',
      body: form
    })
    toast.add({
      title: '应用已保存',
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

async function createVersion() {
  versionError.value = ''
  creatingVersion.value = true

  try {
    const created = await $fetch<AppVersion>(`/api/apps/${appId.value}/versions`, {
      method: 'POST',
      body: versionForm
    })
    toast.add({
      title: '版本已创建',
      color: 'success'
    })
    versionModalOpen.value = false
    resetVersionForm()
    await refreshVersions()
    await navigateTo(`/versions/${created.id}`)
  } catch (error) {
    versionError.value = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : '创建版本失败'
  } finally {
    creatingVersion.value = false
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
            to="/apps"
            label="返回应用列表"
            class="-ml-3 mb-1"
          />
          <h1 class="text-2xl font-semibold">
            {{ app?.name || '应用详情' }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ app?.bundleId }}
          </p>
        </div>

        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            label="创建版本"
            @click="openVersionModal"
          />
          <UButton
            icon="i-lucide-save"
            label="保存应用"
            :loading="saving"
            @click="saveApp"
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
                基本信息
              </h2>
              <p class="mt-1 text-sm text-muted">
                这些信息用于后台识别应用和生成更新接口路径。
              </p>
            </div>
          </template>

          <form class="grid gap-4 lg:grid-cols-2" @submit.prevent="saveApp">
            <UAlert
              v-if="errorMessage"
              class="lg:col-span-2"
              color="error"
              variant="soft"
              icon="i-lucide-circle-alert"
              :title="errorMessage"
            />

            <UFormField label="应用名称" name="name" required>
              <UInput v-model="form.name" class="w-full" />
            </UFormField>

            <UFormField
              label="Slug"
              name="slug"
              description="用于 URL 和更新接口路径，只能包含小写英文、数字和短横线。"
              required
            >
              <UInput v-model="form.slug" class="w-full" />
            </UFormField>

            <UFormField label="Bundle ID" name="bundleId" required>
              <UInput v-model="form.bundleId" class="w-full" />
            </UFormField>

            <UFormField label="默认通道" name="defaultChannel" required>
              <UInput v-model="form.defaultChannel" class="w-full" />
            </UFormField>

            <UFormField class="lg:col-span-2" label="描述" name="description">
              <UTextarea v-model="form.description" class="w-full" :rows="4" />
            </UFormField>

            <div class="lg:col-span-2">
              <USwitch v-model="form.enabled" label="启用应用" />
            </div>
          </form>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="text-base font-semibold">
                  版本列表
                </h2>
                <p class="mt-1 text-sm text-muted">
                  管理该应用的 Electron 版本草稿和发布记录。
                </p>
              </div>

              <UButton
                icon="i-lucide-plus"
                label="创建版本"
                @click="openVersionModal"
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
                    通道
                  </th>
                  <th class="px-4 py-3 font-medium">
                    状态
                  </th>
                  <th class="px-4 py-3 font-medium">
                    强制更新
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="versions.length === 0">
                  <td class="px-4 py-8 text-center text-muted" colspan="5">
                    暂无版本
                  </td>
                </tr>
                <template v-else>
                  <tr
                    v-for="version in versions"
                    :key="version.id"
                    class="border-b border-muted last:border-b-0"
                  >
                    <td class="px-4 py-3">
                      <NuxtLink :to="`/versions/${version.id}`" class="font-medium text-highlighted">
                        {{ version.version }}
                      </NuxtLink>
                      <p v-if="version.buildNumber" class="text-xs text-muted">
                        build {{ version.buildNumber }}
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      <UBadge color="neutral" variant="subtle" :label="version.channel" />
                    </td>
                    <td class="px-4 py-3">
                      <UBadge
                        :color="statusColor(version.status)"
                        variant="subtle"
                        :label="statusLabel(version.status)"
                      />
                    </td>
                    <td class="px-4 py-3">
                      {{ version.forceUpdate ? '是' : '否' }}
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex justify-end">
                        <UButton
                          color="neutral"
                          variant="ghost"
                          icon="i-lucide-pencil"
                          :to="`/versions/${version.id}`"
                          aria-label="编辑"
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
            <div>
              <h2 class="text-base font-semibold">
                更新接口
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

              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Platform" name="endpointPlatform">
                  <USelect v-model="endpointForm.platform" class="w-full" :items="platformItems" />
                </UFormField>

                <UFormField label="Arch" name="endpointArch">
                  <USelect v-model="endpointForm.arch" class="w-full" :items="archItems" />
                </UFormField>
              </div>
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
                  electron-updater
                </p>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-copy"
                  aria-label="复制 electron-updater URL"
                  :disabled="!metadataUrl"
                  @click="copyText(metadataUrl, 'electron-updater URL')"
                />
              </div>
              <code class="block break-all rounded bg-elevated px-2 py-1 text-xs">
                {{ metadataUrl || '-' }}
              </code>
            </div>
          </div>
        </UCard>

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
                :color="app?.enabled ? 'success' : 'neutral'"
                variant="subtle"
                :label="app?.enabled ? '启用' : '停用'"
              />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">默认通道</span>
              <UBadge color="neutral" variant="subtle" :label="app?.defaultChannel || '-'" />
            </div>
          </div>
        </UCard>
      </aside>
    </section>

    <UModal
      v-model:open="versionModalOpen"
      title="创建版本"
      description="创建 Electron 更新版本草稿，后续可上传全量包或增量包。"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <form id="create-version-form" class="grid gap-4" @submit.prevent="createVersion">
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

          <UFormField label="构建号" name="buildNumber">
            <UInput v-model="versionForm.buildNumber" class="w-full" placeholder="100" />
          </UFormField>

          <UFormField label="通道" name="channel" required>
            <UInput v-model="versionForm.channel" class="w-full" placeholder="latest" />
          </UFormField>

          <USwitch v-model="versionForm.forceUpdate" label="强制更新" />

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
          form="create-version-form"
          icon="i-lucide-save"
          label="保存"
          :loading="creatingVersion"
        />
      </template>
    </UModal>
  </main>
</template>
