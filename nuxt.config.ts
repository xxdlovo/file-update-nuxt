import { resolve } from 'node:path'

const sqliteWatchIgnored = [
  '**/data/**',
  '**/.data/**',
  '**/*.db',
  '**/*.db-*',
  '**/*.sqlite',
  '**/*.sqlite-*'
]

export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  ignore: sqliteWatchIgnored,
  devtools: { enabled: false },
  ssr: true,
     devServer: {
        host: '0.0.0.0',
        port: 3000
    },
  ui: {
    fonts: false
  },
  vite: {
    optimizeDeps: {
      include: [
        '@floating-ui/dom',
        '@floating-ui/vue',
        '@internationalized/date',
        '@internationalized/number',
        '@nuxt/ui/runtime/composables',
        '@nuxt/ui/runtime/utils',
        '@vueuse/core',
        '@vueuse/shared',
        'reka-ui',
        'tailwind-merge',
        'tailwind-variants',
        'ufo',
        'vaul-vue'
      ]
    },
    server: {
      watch: {
        ignored: sqliteWatchIgnored
      },
      warmup: {
        clientFiles: [
          resolve('app/app.vue'),
          resolve('app/layouts/default.vue'),
          resolve('app/pages/dashboard.vue'),
          resolve('app/pages/apps/index.vue'),
          resolve('app/pages/files/index.vue')
        ]
      }
    }
  },
  runtimeConfig: {
    session: {
      password: process.env.NUXT_SESSION_PASSWORD
    },
    databaseUrl: process.env.DATABASE_URL || 'file:./data/app.db',
    updateTokenRequired: process.env.UPDATE_TOKEN_REQUIRED === 'true',
    fileUpdateTokenRequired: process.env.FILE_UPDATE_TOKEN_REQUIRED === 'true',
    ciApiToken: process.env.CI_API_TOKEN,
    ciApiTokenHash: process.env.CI_API_TOKEN_SHA256,
    public: {
      downloadUrlExpiresSeconds: Number(process.env.DOWNLOAD_URL_EXPIRES_SECONDS || 600)
    }
  },
  compatibilityDate: '2026-07-08'
})
