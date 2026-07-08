export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  ssr: false,
  ui: {
    fonts: false
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
    public: {
      downloadUrlExpiresSeconds: Number(process.env.DOWNLOAD_URL_EXPIRES_SECONDS || 600)
    }
  },
  compatibilityDate: '2026-07-08'
})
