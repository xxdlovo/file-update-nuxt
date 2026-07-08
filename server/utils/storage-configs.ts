import { eq } from 'drizzle-orm'
import { storageConfigs } from '../../db/schema'

type StorageConfigInput = {
  name?: string
  provider?: string
  region?: string
  accessKeyId?: string
  accessKeySecret?: string
  bucket?: string
  endpoint?: string | null
  publicBaseUrl?: string | null
  uploadDir?: string
  fileReleaseDir?: string
  enabled?: boolean
}

export function sanitizeStorageConfig(config: typeof storageConfigs.$inferSelect) {
  return {
    id: config.id,
    name: config.name,
    provider: config.provider,
    region: config.region,
    accessKeyId: maskAccessKey(config.accessKeyId),
    bucket: config.bucket,
    endpoint: config.endpoint,
    publicBaseUrl: config.publicBaseUrl,
    uploadDir: config.uploadDir,
    fileReleaseDir: config.fileReleaseDir,
    enabled: config.enabled,
    verified: config.verified,
    verifiedAt: config.verifiedAt,
    lastVerifyStatus: config.lastVerifyStatus,
    lastVerifyMessage: config.lastVerifyMessage,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  }
}

export function normalizeStorageConfigInput(input: StorageConfigInput, requireSecret = true) {
  const provider = normalizeStorageProvider(input.provider)
  const name = input.name?.trim()
  const region = provider === 'upyun_uss' ? 'global' : input.region?.trim()
  const accessKeyId = input.accessKeyId?.trim()
  const accessKeySecret = input.accessKeySecret?.trim()
  const bucket = input.bucket?.trim()

  if (!name || !region || !accessKeyId || !bucket || (requireSecret && !accessKeySecret)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name, region, access key and bucket are required'
    })
  }

  return {
    name,
    provider,
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
    endpoint: provider === 'upyun_uss' ? 's3.api.upyun.com' : input.endpoint?.trim() || null,
    publicBaseUrl: input.publicBaseUrl?.trim() || null,
    uploadDir: input.uploadDir?.trim() || 'electron-updates',
    fileReleaseDir: input.fileReleaseDir?.trim() || 'files',
    enabled: input.enabled ?? true
  }
}

export async function getStorageConfigRecord(id: number) {
  const db = useDb()
  const config = await db.query.storageConfigs.findFirst({
    where: eq(storageConfigs.id, id)
  })

  if (!config) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Storage config not found'
    })
  }

  return config
}

function maskAccessKey(value: string) {
  if (value.length <= 8) {
    return '********'
  }

  return `${value.slice(0, 4)}****${value.slice(-4)}`
}
