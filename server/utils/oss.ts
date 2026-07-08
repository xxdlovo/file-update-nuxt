import { createHmac, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { storageConfigs } from '../../db/schema'

type OssConfig = {
  id?: number | null
  region: string
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  endpoint?: string | null
  publicBaseUrl?: string | null
  uploadDir?: string | null
  fileReleaseDir?: string | null
}

type UploadTarget = {
  appSlug: string
  version: string
  platform: string
  arch: string
  packageType: string
  fileName: string
}

const allowedPlatforms = ['win32', 'darwin', 'linux']
const allowedArchs = ['x64', 'arm64']
const allowedPackageTypes = ['full', 'delta', 'blockmap', 'metadata']

export function assertUploadTarget(input: {
  platform?: string
  arch?: string
  packageType?: string
}) {
  if (!input.platform || !allowedPlatforms.includes(input.platform)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid platform'
    })
  }

  if (!input.arch || !allowedArchs.includes(input.arch)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid arch'
    })
  }

  if (!input.packageType || !allowedPackageTypes.includes(input.packageType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid package type'
    })
  }
}

export function requireOssConfig(): OssConfig {
  const config = useRuntimeConfig()
  const oss = config.oss

  if (!oss.region || !oss.accessKeyId || !oss.accessKeySecret || !oss.bucket) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OSS is not configured'
    })
  }

  return oss
}

export async function getVerifiedStorageConfigs() {
  const db = useDb()

  return db.query.storageConfigs.findMany({
    where: (table, { and, eq }) => and(
      eq(table.provider, 'aliyun_oss'),
      eq(table.enabled, true),
      eq(table.verified, true)
    ),
    orderBy: (table, { asc }) => [asc(table.name)]
  })
}

export async function getStorageConfigById(id: number, verifiedOnly = false) {
  const db = useDb()
  const config = await db.query.storageConfigs.findFirst({
    where: eq(storageConfigs.id, id)
  })

  if (!config || !config.enabled || (verifiedOnly && !config.verified)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Storage config not found'
    })
  }

  return config
}

export async function resolveUploadStorageConfig(storageConfigId?: number) {
  if (storageConfigId) {
    return getStorageConfigById(storageConfigId, true)
  }

  const configs = await getVerifiedStorageConfigs()

  if (configs[0]) {
    return configs[0]
  }

  return requireOssConfig()
}

export function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim()
  const fallback = 'package.bin'

  return (trimmed || fallback)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
}

export function createUpdateObjectKey(target: UploadTarget, oss?: Pick<OssConfig, 'uploadDir'>) {
  const config = useRuntimeConfig()
  const safeFileName = sanitizeFileName(target.fileName)

  return [
    oss?.uploadDir || config.oss.uploadDir || 'electron-updates',
    target.appSlug,
    target.version,
    target.platform,
    target.arch,
    target.packageType,
    `${Date.now()}-${randomUUID()}-${safeFileName}`
  ].join('/')
}

export function createSignedUploadUrl(objectKey: string, contentType?: string, ossConfig?: OssConfig) {
  const config = useRuntimeConfig()
  const oss = ossConfig || requireOssConfig()
  const expires = Number(config.public.downloadUrlExpiresSeconds || 600)
  const expiresAt = Math.floor(Date.now() / 1000) + expires
  const normalizedContentType = contentType || 'application/octet-stream'
  const resource = `/${oss.bucket}/${objectKey}`
  const stringToSign = [
    'PUT',
    '',
    normalizedContentType,
    String(expiresAt),
    resource
  ].join('\n')
  const signature = createHmac('sha1', oss.accessKeySecret)
    .update(stringToSign)
    .digest('base64')
  const url = new URL(createObjectUrl(objectKey, oss))

  url.searchParams.set('OSSAccessKeyId', oss.accessKeyId)
  url.searchParams.set('Expires', String(expiresAt))
  url.searchParams.set('Signature', signature)

  return url.toString()
}

export async function createSignedDownloadUrl(objectKey: string, storageConfigId?: number | null) {
  const config = useRuntimeConfig()
  const oss = storageConfigId
    ? await getStorageConfigById(storageConfigId)
    : requireOssConfig()
  const expires = Number(config.public.downloadUrlExpiresSeconds || 600)
  const expiresAt = Math.floor(Date.now() / 1000) + expires
  const resource = `/${oss.bucket}/${objectKey}`
  const stringToSign = [
    'GET',
    '',
    '',
    String(expiresAt),
    resource
  ].join('\n')
  const signature = createHmac('sha1', oss.accessKeySecret)
    .update(stringToSign)
    .digest('base64')
  const url = new URL(createObjectUrl(objectKey, oss))

  url.searchParams.set('OSSAccessKeyId', oss.accessKeyId)
  url.searchParams.set('Expires', String(expiresAt))
  url.searchParams.set('Signature', signature)

  return url.toString()
}

export async function verifyAliyunOssConfig(input: OssConfig) {
  const objectKey = [
    input.uploadDir || 'electron-updates',
    '_verify',
    `${Date.now()}-${randomUUID()}.txt`
  ].join('/')
  const contentType = 'text/plain; charset=utf-8'
  const body = `storage config verify ${new Date().toISOString()}\n`
  const putResponse = await signedOssRequest(input, {
    method: 'PUT',
    objectKey,
    contentType,
    body
  })

  if (!putResponse.ok) {
    return {
      ok: false,
      status: putResponse.status,
      message: `Upload test object failed with ${putResponse.status}`
    }
  }

  const deleteResponse = await signedOssRequest(input, {
    method: 'DELETE',
    objectKey
  })

  if (!deleteResponse.ok) {
    return {
      ok: false,
      status: deleteResponse.status,
      message: `Upload succeeded but delete failed with ${deleteResponse.status}. Test object: ${objectKey}`
    }
  }

  return {
    ok: true,
    status: deleteResponse.status,
    message: 'Upload and delete verified'
  }
}

async function signedOssRequest(
  oss: OssConfig,
  input: {
    method: 'PUT' | 'DELETE'
    objectKey: string
    contentType?: string
    body?: BodyInit
  }
) {
  const date = new Date().toUTCString()
  const contentType = input.contentType || ''
  const resource = `/${oss.bucket}/${input.objectKey}`
  const stringToSign = [
    input.method,
    '',
    contentType,
    date,
    resource
  ].join('\n')
  const signature = createHmac('sha1', oss.accessKeySecret)
    .update(stringToSign)
    .digest('base64')

  return fetch(createObjectUrl(input.objectKey, oss), {
    method: input.method,
    headers: {
      Date: date,
      Authorization: `OSS ${oss.accessKeyId}:${signature}`,
      ...(contentType ? { 'Content-Type': contentType } : {})
    },
    body: input.body
  })
}

function createObjectUrl(objectKey: string, oss: OssConfig) {
  if (oss.publicBaseUrl) {
    return `${oss.publicBaseUrl.replace(/\/$/, '')}/${objectKey}`
  }

  return `https://${oss.bucket}.${normalizeEndpoint(oss)}/${objectKey}`
}

function normalizeEndpoint(oss: Pick<OssConfig, 'endpoint' | 'region'>) {
  return (oss.endpoint || `${oss.region}.aliyuncs.com`)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
}
