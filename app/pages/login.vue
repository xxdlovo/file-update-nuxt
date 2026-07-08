<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const toast = useToast()
const { fetch: refreshSession } = useUserSession()

const state = reactive({
  email: '',
  password: ''
})

const loading = ref(false)
const errorMessage = ref('')

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: state
    })
    await refreshSession()
    toast.add({
      title: '登录成功',
      color: 'success'
    })
    await navigateTo('/dashboard')
  } catch (error) {
    const message = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : '登录失败，请检查邮箱和密码'

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
            管理员登录
          </h1>
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="errorMessage"
        />

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
            autocomplete="current-password"
            placeholder="请输入密码"
          />
        </UFormField>

        <UButton
          block
          type="submit"
          icon="i-lucide-log-in"
          label="登录"
          :loading="loading"
        />
      </form>
    </UCard>
  </div>
</template>
