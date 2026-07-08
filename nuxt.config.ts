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
    oss: {
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      endpoint: process.env.OSS_ENDPOINT,
      publicBaseUrl: process.env.OSS_PUBLIC_BASE_URL,
      uploadDir: process.env.OSS_UPLOAD_DIR || 'electron-updates',
      fileReleaseDir: process.env.OSS_FILE_RELEASE_DIR || 'files'
    },
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
