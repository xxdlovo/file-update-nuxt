<script setup lang="ts">
type AppItem = {
  id: number
  name: string
  slug: string
  bundleId: string
  defaultChannel: string
  enabled: boolean
  description: string | null
  updatedAt: string
}

const toast = useToast()
const search = ref('')
const includeDisabled = ref(false)
const creating = ref(false)
const createOpen = ref(false)
const editingApp = ref<AppItem | null>(null)
const slugTouched = ref(false)
const errorMessage = ref('')
const form = reactive({
  name: '',
  slug: '',
  bundleId: '',
  defaultChannel: 'latest',
  enabled: true,
  description: ''
})

const query = computed(() => ({
  q: search.value || undefined,
  includeDisabled: includeDisabled.value ? 'true' : undefined
}))

const { data, status, refresh } = useLazyFetch<{ items: AppItem[], total: number }>('/api/apps', {
  query,
  watch: [query]
})

const apps = computed(() => data.value?.items || [])

watch(() => form.name, (value) => {
  if (!slugTouched.value) {
    form.slug = toSlug(value)
  }
})

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function onSlugInput(value: string) {
  slugTouched.value = true
  form.slug = toSlug(value)
}

function openCreateModal() {
  resetForm()
  editingApp.value = null
  createOpen.value = true
}

function openEditModal(app: AppItem) {
  editingApp.value = app
  form.name = app.name
  form.slug = app.slug
  form.bundleId = app.bundleId
  form.defaultChannel = app.defaultChannel
  form.enabled = app.enabled
  form.description = app.description || ''
  slugTouched.value = true
  errorMessage.value = ''
  createOpen.value = true
}

function resetForm() {
  form.name = ''
  form.slug = ''
  form.bundleId = ''
  form.defaultChannel = 'latest'
  form.enabled = true
  form.description = ''
  slugTouched.value = false
  errorMessage.value = ''
}

async function submitApp() {
  errorMessage.value = ''
  creating.value = true

  try {
    await $fetch(editingApp.value ? `/api/apps/${editingApp.value.id}` : '/api/apps', {
      method: editingApp.value ? 'PATCH' : 'POST',
      body: form
    })
    toast.add({
      title: editingApp.value ? '应用已更新' : '应用已创建',
      color: 'success'
    })
    createOpen.value = false
    editingApp.value = null
    resetForm()
    await refresh()
  } catch (error) {
    errorMessage.value = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : editingApp.value ? '更新失败' : '创建失败'
  } finally {
    creating.value = false
  }
}

async function disableApp(app: AppItem) {
  await $fetch(`/api/apps/${app.id}`, { method: 'DELETE' })
  toast.add({
    title: '应用已停用',
    color: 'success'
  })
  await refresh()
}
</script>

<template>
  <main>
    <section class="border-b border-muted px-6 py-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-muted">
            Electron 升级
          </p>
          <h1 class="mt-1 text-2xl font-semibold">
            应用管理
          </h1>
        </div>

        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            label="刷新"
            :loading="status === 'pending'"
            @click="refresh"
          />
          <UButton
            icon="i-lucide-plus"
            label="创建应用"
            @click="openCreateModal"
          />
        </div>
      </div>
    </section>

    <section class="space-y-6 px-6 py-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <UInput
          v-model="search"
          class="w-full sm:max-w-sm"
          icon="i-lucide-search"
          placeholder="搜索名称、slug 或 Bundle ID"
        />

        <UCheckbox
          v-model="includeDisabled"
          label="显示已停用"
        />
      </div>

      <UCard>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-muted text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">
                  应用
                </th>
                <th class="px-4 py-3 font-medium">
                  Bundle ID
                </th>
                <th class="px-4 py-3 font-medium">
                  通道
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
              <tr v-if="status === 'pending'">
                <td class="px-4 py-8 text-center text-muted" colspan="5">
                  加载中
                </td>
              </tr>
              <tr v-else-if="apps.length === 0">
                <td class="px-4 py-8 text-center text-muted" colspan="5">
                  暂无应用
                </td>
              </tr>
              <template v-else>
                <tr
                  v-for="app in apps"
                  :key="app.id"
                  class="border-b border-muted last:border-b-0"
                >
                  <td class="px-4 py-3">
                    <div>
                      <NuxtLink :to="`/apps/${app.id}`" class="font-medium text-highlighted">
                        {{ app.name }}
                      </NuxtLink>
                      <p class="text-xs text-muted">
                        {{ app.slug }}
                      </p>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-muted">
                    {{ app.bundleId }}
                  </td>
                  <td class="px-4 py-3">
                    <UBadge color="neutral" variant="subtle" :label="app.defaultChannel" />
                  </td>
                  <td class="px-4 py-3">
                    <UBadge
                      :color="app.enabled ? 'success' : 'neutral'"
                      variant="subtle"
                      :label="app.enabled ? '启用' : '停用'"
                    />
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-eye"
                        :to="`/apps/${app.id}`"
                        aria-label="详情"
                      />
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-pencil"
                        aria-label="修改"
                        @click="openEditModal(app)"
                      />
                      <UButton
                        v-if="app.enabled"
                        color="error"
                        variant="ghost"
                        icon="i-lucide-ban"
                        aria-label="停用"
                        @click="disableApp(app)"
                      />
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </UCard>
    </section>

    <UModal
      v-model:open="createOpen"
      :title="editingApp ? '修改应用' : '创建应用'"
      :description="editingApp ? '变更应用的基础信息。' : '为 Electron 客户端创建一个升级管理对象。'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <form id="app-form" class="grid gap-4" @submit.prevent="submitApp">
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="errorMessage"
          />

          <UFormField label="应用名称" name="name" required>
            <UInput v-model="form.name" class="w-full" placeholder="Acme Desktop" />
          </UFormField>

          <UFormField
            label="Slug"
            name="slug"
            description="用于 URL 和更新接口路径，只能包含小写英文、数字和短横线。中文名称会被自动过滤，需要手动填写英文标识。"
            required
          >
            <UInput
              :model-value="form.slug"
              class="w-full"
              placeholder="acme-desktop"
              @update:model-value="onSlugInput(String($event))"
            />
          </UFormField>

          <UFormField label="Bundle ID" name="bundleId" required>
            <UInput v-model="form.bundleId" class="w-full" placeholder="com.acme.desktop" />
          </UFormField>

          <UFormField label="默认通道" name="defaultChannel" required>
            <UInput v-model="form.defaultChannel" class="w-full" placeholder="latest" />
          </UFormField>

          <USwitch v-model="form.enabled" label="启用应用" />

          <UFormField label="描述" name="description">
            <UTextarea v-model="form.description" class="w-full" :rows="3" />
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
          form="app-form"
          icon="i-lucide-save"
          label="保存"
          :loading="creating"
        />
      </template>
    </UModal>
  </main>
</template>
