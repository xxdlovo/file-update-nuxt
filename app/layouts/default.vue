<script setup lang="ts">
const route = useRoute()
const { user, clear } = useUserSession()

const navigation = [{
  label: 'Dashboard',
  icon: 'i-lucide-layout-dashboard',
  to: '/dashboard'
}, {
  label: '应用管理',
  icon: 'i-lucide-monitor-up',
  to: '/apps'
}, {
  label: '普通文件',
  icon: 'i-lucide-files',
  to: '/files'
}, {
  label: '存储配置',
  icon: 'i-lucide-database',
  to: '/storage-configs'
}, {
  label: '设置',
  icon: 'i-lucide-settings',
  to: '/settings'
}]

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <aside class="fixed inset-y-0 left-0 hidden w-64 border-r border-muted bg-elevated lg:block">
      <div class="flex h-full flex-col">
        <div class="border-b border-muted px-5 py-4">
          <p class="text-xs font-medium uppercase text-muted">
            Electron Update
          </p>
          <h1 class="mt-1 text-base font-semibold">
            发布管理后台
          </h1>
        </div>

        <nav class="flex-1 space-y-1 px-3 py-4">
          <UButton
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            :icon="item.icon"
            :label="item.label"
            :color="route.path === item.to || route.path.startsWith(`${item.to}/`) ? 'primary' : 'neutral'"
            :variant="route.path === item.to || route.path.startsWith(`${item.to}/`) ? 'soft' : 'ghost'"
            block
            class="justify-start"
          />
        </nav>

        <div class="border-t border-muted p-3">
          <div class="mb-3 px-2 text-sm">
            <p class="font-medium">
              {{ user?.name }}
            </p>
            <p class="truncate text-muted">
              {{ user?.email }}
            </p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-log-out"
            label="退出登录"
            block
            class="justify-start"
            @click="logout"
          />
        </div>
      </div>
    </aside>

    <div class="lg:pl-64">
      <header class="sticky top-0 z-10 border-b border-muted bg-default/90 backdrop-blur lg:hidden">
        <div class="flex h-14 items-center justify-between px-4">
          <span class="font-semibold">发布管理后台</span>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-log-out"
            aria-label="退出登录"
            @click="logout"
          />
        </div>
      </header>

      <slot />
    </div>
  </div>
</template>
