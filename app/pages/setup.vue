<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const toast = useToast()
const { fetch: refreshSession } = useUserSession()

const state = reactive({
  name: 'Administrator',
  email: '',
  password: ''
})

const loading = ref(false)
const initialized = ref(false)
const errorMessage = ref('')

const status = await $fetch('/api/setup/status')
initialized.value = status.initialized

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  try {
    await $fetch('/api/setup/admin', {
      method: 'POST',
      body: state
    })

    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: state.email,
        password: state.password
      }
    })

    await refreshSession()
    toast.add({
      title: '管理员已创建',
      color: 'success'
    })
    await navigateTo('/dashboard')
  } catch (error) {
    const message = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : '初始化失败，请检查输入'

    errorMessage.value = message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-6 py-12">
    <UCard class="w-full max-w-sm">
      <template #header>
        <div class="space-y-1 text-center">
          <p class="text-sm font-medium text-muted">
            Electron Update Service
          </p>
          <h1 class="text-xl font-semibold text-default">
            初始化管理员
          </h1>
        </div>
      </template>

      <UAlert
        v-if="initialized"
        color="warning"
        variant="soft"
        icon="i-lucide-lock"
        title="系统已经初始化"
      >
        <template #description>
          请前往登录页继续。
        </template>
      </UAlert>

      <form v-else class="space-y-4" @submit.prevent="onSubmit">
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="errorMessage"
        />

        <UFormField label="名称" name="name" required>
          <UInput
            v-model="state.name"
            class="w-full"
            autocomplete="name"
          />
        </UFormField>

        <UFormField label="邮箱" name="email" required>
          <UInput
            v-model="state.email"
            class="w-full"
            type="email"
            autocomplete="email"
            placeholder="admin@example.com"
          />
        </UFormField>

        <UFormField label="密码" name="password" required>
          <UInput
            v-model="state.password"
            class="w-full"
            type="password"
            autocomplete="new-password"
            placeholder="至少 8 个字符"
          />
        </UFormField>

        <UButton
          block
          type="submit"
          icon="i-lucide-user-plus"
          label="创建管理员"
          :loading="loading"
        />
      </form>

      <template #footer>
        <div class="text-center">
          <UButton
            color="neutral"
            variant="link"
            to="/login"
            label="返回登录"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
