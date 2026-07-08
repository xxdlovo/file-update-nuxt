<script setup lang="ts">
const { data: appsData } = await useFetch('/api/apps', {
  query: { includeDisabled: true }
})

const totalApps = computed(() => appsData.value?.total || 0)
</script>

<template>
  <main>
    <section class="border-b border-muted px-6 py-5">
      <p class="text-sm text-muted">
        总览
      </p>
      <h1 class="mt-1 text-2xl font-semibold">
        Dashboard
      </h1>
    </section>

    <section class="px-6 py-6">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UCard>
          <p class="text-sm text-muted">
            应用
          </p>
          <p class="mt-2 text-3xl font-semibold">
            {{ totalApps }}
          </p>
        </UCard>

        <UCard>
          <p class="text-sm text-muted">
            Electron 版本
          </p>
          <p class="mt-2 text-3xl font-semibold">
            0
          </p>
        </UCard>

        <UCard>
          <p class="text-sm text-muted">
            普通文件项目
          </p>
          <p class="mt-2 text-3xl font-semibold">
            0
          </p>
        </UCard>

        <UCard>
          <p class="text-sm text-muted">
            发布记录
          </p>
          <p class="mt-2 text-3xl font-semibold">
            0
          </p>
        </UCard>
      </div>
    </section>
  </main>
</template>
