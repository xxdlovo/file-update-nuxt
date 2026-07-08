<script setup lang="ts">
type FileProjectItem = {
  id: number
  name: string
  slug: string
  category: string | null
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
const editingProject = ref<FileProjectItem | null>(null)
const slugTouched = ref(false)
const errorMessage = ref('')
const form = reactive({
  name: '',
  slug: '',
  category: '',
  defaultChannel: 'stable',
  enabled: true,
  description: ''
})

const query = computed(() => ({
  q: search.value || undefined,
  includeDisabled: includeDisabled.value ? 'true' : undefined
}))

const { data, status, refresh } = useLazyFetch<{ items: FileProjectItem[], total: number }>('/api/files', {
  query,
  watch: [query]
})

const projects = computed(() => data.value?.items || [])

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
  editingProject.value = null
  createOpen.value = true
}

function openEditModal(project: FileProjectItem) {
  editingProject.value = project
  form.name = project.name
  form.slug = project.slug
  form.category = project.category || ''
  form.defaultChannel = project.defaultChannel
  form.enabled = project.enabled
  form.description = project.description || ''
  slugTouched.value = true
  errorMessage.value = ''
  createOpen.value = true
}

function resetForm() {
  form.name = ''
  form.slug = ''
  form.category = ''
  form.defaultChannel = 'stable'
  form.enabled = true
  form.description = ''
  slugTouched.value = false
  errorMessage.value = ''
}

async function submitProject() {
  errorMessage.value = ''
  creating.value = true

  try {
    await $fetch(editingProject.value ? `/api/files/${editingProject.value.id}` : '/api/files', {
      method: editingProject.value ? 'PATCH' : 'POST',
      body: form
    })
    toast.add({
      title: editingProject.value ? '文件项目已更新' : '文件项目已创建',
      color: 'success'
    })
    createOpen.value = false
    editingProject.value = null
    resetForm()
    await refresh()
  } catch (error) {
    errorMessage.value = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : editingProject.value ? '更新失败' : '创建失败'
  } finally {
    creating.value = false
  }
}

async function disableProject(project: FileProjectItem) {
  await $fetch(`/api/files/${project.id}`, { method: 'DELETE' })
  toast.add({
    title: '文件项目已停用',
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
            普通文件
          </p>
          <h1 class="mt-1 text-2xl font-semibold">
            文件项目
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
            label="创建项目"
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
          placeholder="搜索名称、slug 或分类"
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
                  项目
                </th>
                <th class="px-4 py-3 font-medium">
                  分类
                </th>
                <th class="px-4 py-3 font-medium">
                  默认通道
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
              <tr v-else-if="projects.length === 0">
                <td class="px-4 py-8 text-center text-muted" colspan="5">
                  暂无文件项目
                </td>
              </tr>
              <template v-else>
                <tr
                  v-for="project in projects"
                  :key="project.id"
                  class="border-b border-muted last:border-b-0"
                >
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/files/${project.id}`" class="font-medium text-highlighted">
                      {{ project.name }}
                    </NuxtLink>
                    <p class="text-xs text-muted">
                      {{ project.slug }}
                    </p>
                  </td>
                  <td class="px-4 py-3 text-muted">
                    {{ project.category || '-' }}
                  </td>
                  <td class="px-4 py-3">
                    <UBadge color="neutral" variant="subtle" :label="project.defaultChannel" />
                  </td>
                  <td class="px-4 py-3">
                    <UBadge
                      :color="project.enabled ? 'success' : 'neutral'"
                      variant="subtle"
                      :label="project.enabled ? '启用' : '停用'"
                    />
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-eye"
                        :to="`/files/${project.id}`"
                        aria-label="详情"
                      />
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-pencil"
                        aria-label="修改"
                        @click="openEditModal(project)"
                      />
                      <UButton
                        v-if="project.enabled"
                        color="error"
                        variant="ghost"
                        icon="i-lucide-ban"
                        aria-label="停用"
                        @click="disableProject(project)"
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
      :title="editingProject ? '修改文件项目' : '创建文件项目'"
      :description="editingProject ? '变更文件项目的基础信息。' : '为普通文件创建独立的版本发布对象。'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <form id="file-project-form" class="grid gap-4" @submit.prevent="submitProject">
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="errorMessage"
          />

          <UFormField label="项目名称" name="name" required>
            <UInput v-model="form.name" class="w-full" placeholder="安装器配置文件" />
          </UFormField>

          <UFormField
            label="Slug"
            name="slug"
            description="用于普通文件检查更新接口路径，只能包含小写英文、数字和短横线。"
            required
          >
            <UInput
              :model-value="form.slug"
              class="w-full"
              placeholder="installer-config"
              @update:model-value="onSlugInput(String($event))"
            />
          </UFormField>

          <UFormField label="分类" name="category">
            <UInput v-model="form.category" class="w-full" placeholder="配置 / 资源 / 工具" />
          </UFormField>

          <UFormField label="默认通道" name="defaultChannel" required>
            <UInput v-model="form.defaultChannel" class="w-full" placeholder="stable" />
          </UFormField>

          <USwitch v-model="form.enabled" label="启用项目" />

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
          form="file-project-form"
          icon="i-lucide-save"
          label="保存"
          :loading="creating"
        />
      </template>
    </UModal>
  </main>
</template>
