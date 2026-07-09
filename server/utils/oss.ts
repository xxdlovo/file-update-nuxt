import { createHash, createHmac, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { storageConfigs } from '../../db/schema'

type StorageProvider = 'aliyun_oss' | 'tencent_cos' | 'qiniu_kodo' | 'aws_s3' | 'upyun_uss'

type OssConfig = {
  id?: number | null
  provider?: string | null
  region: string
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  endpoint?: string | null
  publicBaseUrl?: string | null
  cdnAuthToken?: string | null
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

type FileReleaseUploadTarget = {
  fileSlug: string
  version: string
  channel: string
  environment: string
  fileName: string
}

type SignedUploadRequest = {
  method: 'PUT' | 'POST'
  uploadUrl: string
  headers: Record<string, string>
  fields?: Record<string, string>
}

type VerificationResult = {
  ok: boolean
  status: number
  message: string
}

const allowedPlatforms = ['win32', 'darwin', 'linux']
const allowedArchs = ['x64', 'arm64']
const allowedPackageTypes = ['full', 'delta', 'blockmap', 'metadata']
const supportedProviders: StorageProvider[] = ['aliyun_oss', 'tencent_cos', 'qiniu_kodo', 'aws_s3', 'upyun_uss']

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

export function normalizeStorageProvider(provider?: string | null): StorageProvider {
  const value = provider || 'aliyun_oss'

  if (!supportedProviders.includes(value as StorageProvider)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported storage provider'
    })
  }

  return value as StorageProvider
}

export function storageProviderLabel(provider?: string | null) {
  return {
    aliyun_oss: '阿里云 OSS',
    tencent_cos: '腾讯云 COS',
    qiniu_kodo: '七牛云 Kodo',
    aws_s3: 'AWS S3',
    upyun_uss: 'UPYUN USS'
  }[normalizeStorageProvider(provider)]
}

export function requireOssConfig(): OssConfig {
  throw createError({
    statusCode: 500,
    statusMessage: 'Object storage is not configured'
  })
}

export async function getVerifiedStorageConfigs() {
  const db = useDb()

  return db.query.storageConfigs.findMany({
    where: (table, { and, eq }) => and(
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
  const safeFileName = sanitizeFileName(target.fileName)

  return [
    oss?.uploadDir || 'electron-updates',
    target.appSlug,
    target.version,
    target.platform,
    target.arch,
    target.packageType,
    `${Date.now()}-${randomUUID()}-${safeFileName}`
  ].join('/')
}

export function createFileReleaseObjectKey(target: FileReleaseUploadTarget, oss?: Pick<OssConfig, 'fileReleaseDir'>) {
  const safeFileName = sanitizeFileName(target.fileName)

  return [
    oss?.fileReleaseDir || 'files',
    target.fileSlug,
    target.channel,
    target.environment,
    target.version,
    `${Date.now()}-${randomUUID()}-${safeFileName}`
  ].join('/')
}

export function createSignedUploadRequest(objectKey: string, contentType?: string, ossConfig?: OssConfig): SignedUploadRequest {
  const oss = ossConfig || requireOssConfig()
  const provider = normalizeStorageProvider(oss.provider)
  const normalizedContentType = contentType || 'application/octet-stream'

  if (provider === 'qiniu_kodo') {
    return createQiniuUploadRequest(objectKey, oss)
  }

  return {
    method: 'PUT',
    uploadUrl: createSignedObjectUrl('PUT', objectKey, oss, normalizedContentType),
    headers: {
      'Content-Type': normalizedContentType
    }
  }
}

export function createSignedUploadUrl(objectKey: string, contentType?: string, ossConfig?: OssConfig) {
  return createSignedUploadRequest(objectKey, contentType, ossConfig).uploadUrl
}

export async function createSignedDownloadUrl(objectKey: string, storageConfigId?: number | null) {
  const oss = storageConfigId
    ? await getStorageConfigById(storageConfigId)
    : requireOssConfig()

  return createSignedObjectUrl('GET', objectKey, oss)
}

export async function deleteStoredObject(objectKey: string, storageConfigId?: number | null) {
  const oss = storageConfigId
    ? await getStorageConfigById(storageConfigId)
    : requireOssConfig()
  const provider = normalizeStorageProvider(oss.provider)
  const response = provider === 'qiniu_kodo'
    ? await deleteQiniuObject(objectKey, oss)
    : provider === 'upyun_uss'
      ? await deleteUpyunObject(objectKey, oss)
      : await fetch(createSignedObjectUrl('DELETE', objectKey, oss), {
          method: 'DELETE'
        })

  if (!response.ok) {
    const detail = await responseTextSuffix(response)

    throw createError({
      statusCode: 502,
      statusMessage: `Delete object failed with ${response.status}${detail}: ${objectKey}`
    })
  }

  return {
    status: response.status,
    objectKey
  }
}

export async function verifyStorageConfig(input: OssConfig): Promise<VerificationResult> {
  const provider = normalizeStorageProvider(input.provider)
  const objectKey = [
    input.uploadDir || 'electron-updates',
    '_verify',
    `${Date.now()}-${randomUUID()}.txt`
  ].join('/')
  const contentType = 'text/plain; charset=utf-8'
  const body = `storage config verify ${new Date().toISOString()}\n`

  if (provider === 'qiniu_kodo') {
    return verifyQiniuConfig(input, objectKey, body)
  }

  const upload = createSignedUploadRequest(objectKey, contentType, input)
  const putResponse = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: upload.headers,
    body
  })

  if (!putResponse.ok) {
    return {
      ok: false,
      status: putResponse.status,
      message: `${storageProviderLabel(provider)} upload test object failed with ${putResponse.status}`
    }
  }

  const deleteResponse = provider === 'upyun_uss'
    ? await deleteUpyunObject(objectKey, input)
    : await fetch(createSignedObjectUrl('DELETE', objectKey, input), {
        method: 'DELETE'
      })

  if (!deleteResponse.ok) {
    const deleteDetail = await responseTextSuffix(deleteResponse)

    return {
      ok: false,
      status: deleteResponse.status,
      message: `Upload succeeded but delete failed with ${deleteResponse.status}${deleteDetail}. Test object: ${objectKey}`
    }
  }

  return {
    ok: true,
    status: deleteResponse.status,
    message: `${storageProviderLabel(provider)} upload and delete verified`
  }
}

export const verifyAliyunOssConfig = verifyStorageConfig

function createSignedObjectUrl(
  method: 'GET' | 'PUT' | 'DELETE',
  objectKey: string,
  oss: OssConfig,
  contentType = ''
) {
  const provider = normalizeStorageProvider(oss.provider)

  if (method === 'GET' && oss.publicBaseUrl && provider !== 'aliyun_oss') {
    return createObjectUrl(objectKey, oss)
  }

  if (provider === 'aliyun_oss') {
    return createAliyunSignedUrl(method, objectKey, oss, contentType)
  }

  if (provider === 'tencent_cos') {
    return createTencentSignedUrl(method, objectKey, oss)
  }

  if (provider === 'aws_s3') {
    return createAwsSignedUrl(method, objectKey, oss)
  }

  if (provider === 'upyun_uss') {
    return createAwsSignedUrl(method, objectKey, {
      ...oss,
      endpoint: normalizeEndpoint(oss),
      publicBaseUrl: null
    })
  }

  return createQiniuSignedDownloadUrl(objectKey, oss)
}

function createAliyunSignedUrl(method: 'GET' | 'PUT' | 'DELETE', objectKey: string, oss: OssConfig, contentType = '') {
  const config = useRuntimeConfig()
  const expires = Number(config.public.downloadUrlExpiresSeconds || 600)
  const expiresAt = Math.floor(Date.now() / 1000) + expires
  const resource = `/${oss.bucket}/${objectKey}`
  const stringToSign = [
    method,
    '',
    contentType,
    String(expiresAt),
    resource
  ].join('\n')
  const signature = createHmac('sha1', oss.accessKeySecret)
    .update(stringToSign)
    .digest('base64')
  const url = new URL(createObjectUrl(objectKey, {
    ...oss,
    publicBaseUrl: null
  }))

  url.searchParams.set('OSSAccessKeyId', oss.accessKeyId)
  url.searchParams.set('Expires', String(expiresAt))
  url.searchParams.set('Signature', signature)

  return url.toString()
}

function createTencentSignedUrl(method: 'GET' | 'PUT' | 'DELETE', objectKey: string, oss: OssConfig) {
  const config = useRuntimeConfig()
  const expires = Number(config.public.downloadUrlExpiresSeconds || 600)
  const start = Math.floor(Date.now() / 1000) - 60
  const end = start + expires
  const keyTime = `${start};${end}`
  const url = new URL(createObjectUrl(objectKey, oss))
  const host = url.host
  const pathname = normalizePathname(url.pathname)
  const httpString = [
    method.toLowerCase(),
    pathname,
    '',
    `host=${rfc3986(host)}\n`
  ].join('\n')
  const stringToSign = [
    'sha1',
    keyTime,
    sha1Hex(httpString),
    ''
  ].join('\n')
  const signKey = hmacHex('sha1', oss.accessKeySecret, keyTime)
  const signature = hmacHex('sha1', signKey, stringToSign)
  const authorization = [
    'q-sign-algorithm=sha1',
    `q-ak=${oss.accessKeyId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    'q-header-list=host',
    'q-url-param-list=',
    `q-signature=${signature}`
  ].join('&')

  url.searchParams.set('sign', authorization)

  return url.toString()
}

function createAwsSignedUrl(method: 'GET' | 'PUT' | 'DELETE', objectKey: string, oss: OssConfig) {
  return createAwsSignedUrlForUrl(method, new URL(createObjectUrl(objectKey, oss)), oss)
}

function createAwsSignedUrlForUrl(method: 'GET' | 'PUT' | 'DELETE', url: URL, oss: OssConfig) {
  const config = useRuntimeConfig()
  const expires = Math.min(Number(config.public.downloadUrlExpiresSeconds || 600), 604800)
  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const service = 's3'
  const region = s3SigningRegion(oss)
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${oss.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host'
  })
  const canonicalQuery = canonicalQueryString(params)
  const canonicalRequest = [
    method,
    normalizePathname(url.pathname),
    canonicalQuery,
    `host:${url.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n')
  const signature = hmacHex('sha256', getAwsSigningKey(oss.accessKeySecret, dateStamp, region, service), stringToSign)

  for (const [key, value] of params) {
    url.searchParams.set(key, value)
  }
  url.searchParams.set('X-Amz-Signature', signature)

  return url.toString()
}

function createUpyunDeleteRequest(objectKey: string, oss: OssConfig) {
  const url = createUpyunPathStyleUrl(objectKey, oss)

  return {
    name: 'path-v4-query',
    url: createAwsSignedUrlForUrl('DELETE', url, oss),
    headers: {}
  }
}

async function deleteUpyunObject(objectKey: string, oss: OssConfig) {
  const requests = [
    createUpyunDeleteRequest(objectKey, oss),
    createUpyunV4HeaderDeleteRequest(objectKey, oss, 'path'),
    createUpyunV2HeaderDeleteRequest(objectKey, oss, 'path'),
    createUpyunV4QueryDeleteRequest(objectKey, oss, 'virtual'),
    createUpyunV4HeaderDeleteRequest(objectKey, oss, 'virtual'),
    createUpyunV2HeaderDeleteRequest(objectKey, oss, 'virtual')
  ]
  const errors: string[] = []

  for (const request of requests) {
    try {
      const response = await fetch(request.url, {
        method: 'DELETE',
        headers: request.headers
      })

      if (response.ok) {
        return response
      }

      errors.push(`${request.name}: ${response.status}${await responseTextSuffix(response)}`)
    } catch (error) {
      errors.push(`${request.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return new Response(errors.join('; '), {
    status: 503,
    statusText: 'UPYUN delete failed'
  })
}

function createUpyunV4QueryDeleteRequest(objectKey: string, oss: OssConfig, style: 'path' | 'virtual') {
  const url = createUpyunUrl(objectKey, oss, style)

  return {
    name: `${style}-v4-query`,
    url: createAwsSignedUrlForUrl('DELETE', url, oss),
    headers: {}
  }
}

function createUpyunV4HeaderDeleteRequest(objectKey: string, oss: OssConfig, style: 'path' | 'virtual') {
  const url = createUpyunUrl(objectKey, oss, style)

  return {
    name: `${style}-v4-header`,
    url: url.toString(),
    headers: createAwsAuthorizationHeaders('DELETE', url, oss, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  }
}

function createUpyunV2HeaderDeleteRequest(objectKey: string, oss: OssConfig, style: 'path' | 'virtual') {
  const url = createUpyunUrl(objectKey, oss, style)
  const date = new Date().toUTCString()
  const stringToSign = [
    'DELETE',
    '',
    '',
    date,
    `/${oss.bucket}/${encodeObjectPath(objectKey)}`
  ].join('\n')
  const signature = createHmac('sha1', oss.accessKeySecret).update(stringToSign).digest('base64')

  return {
    name: `${style}-v2-header`,
    url: url.toString(),
    headers: {
      Authorization: `AWS ${rfc3986(oss.accessKeyId)}:${signature}`,
      Date: date
    }
  }
}

function createUpyunUrl(objectKey: string, oss: OssConfig, style: 'path' | 'virtual') {
  return style === 'path'
    ? createUpyunPathStyleUrl(objectKey, oss)
    : createUpyunVirtualHostUrl(objectKey, oss)
}

function createUpyunPathStyleUrl(objectKey: string, oss: OssConfig) {
  return new URL(`https://${normalizeEndpoint(oss)}/${oss.bucket}/${encodeObjectPath(objectKey)}`)
}

function createUpyunVirtualHostUrl(objectKey: string, oss: OssConfig) {
  return new URL(`https://${oss.bucket}.${normalizeEndpoint(oss)}/${encodeObjectPath(objectKey)}`)
}

function createAwsAuthorizationHeaders(
  method: 'GET' | 'PUT' | 'DELETE',
  url: URL,
  oss: OssConfig,
  payloadHash: string
) {
  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const service = 's3'
  const region = s3SigningRegion(oss)
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders = [
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join('\n') + '\n'
  const canonicalRequest = [
    method,
    normalizePathname(url.pathname),
    canonicalQueryString(url.searchParams),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n')
  const signature = hmacHex('sha256', getAwsSigningKey(oss.accessKeySecret, dateStamp, region, service), stringToSign)

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${rfc3986(oss.accessKeyId)}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  }
}

async function responseTextSuffix(response: Response) {
  const text = await response.text().catch(() => '')

  if (!text) {
    return ''
  }

  return ` ${text.slice(0, 200)}`
}

function createQiniuUploadRequest(objectKey: string, oss: OssConfig): SignedUploadRequest {
  return {
    method: 'POST',
    uploadUrl: createQiniuUploadUrl(oss),
    headers: {},
    fields: {
      token: createQiniuUploadToken(objectKey, oss),
      key: objectKey
    }
  }
}

function createQiniuSignedDownloadUrl(objectKey: string, oss: OssConfig) {
  const config = useRuntimeConfig()
  const expires = Number(config.public.downloadUrlExpiresSeconds || 600)
  const deadline = Math.floor(Date.now() / 1000) + expires
  const url = new URL(createObjectUrl(objectKey, oss))

  url.searchParams.set('e', String(deadline))

  const downloadUrl = url.toString()
  const token = `${oss.accessKeyId}:${base64Url(createHmac('sha1', oss.accessKeySecret).update(downloadUrl).digest())}`

  url.searchParams.set('token', token)

  return url.toString()
}

async function verifyQiniuConfig(oss: OssConfig, objectKey: string, body: string): Promise<VerificationResult> {
  const form = new FormData()

  form.set('token', createQiniuUploadToken(objectKey, oss))
  form.set('key', objectKey)
  form.set('file', new Blob([body], { type: 'text/plain; charset=utf-8' }), 'verify.txt')

  const uploadResponse = await fetch(createQiniuUploadUrl(oss), {
    method: 'POST',
    body: form
  })

  if (!uploadResponse.ok) {
    return {
      ok: false,
      status: uploadResponse.status,
      message: `七牛云 Kodo upload test object failed with ${uploadResponse.status}`
    }
  }

  const deleteResponse = await deleteQiniuObject(objectKey, oss)

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
    message: '七牛云 Kodo upload and delete verified'
  }
}

async function deleteQiniuObject(objectKey: string, oss: OssConfig) {
  const deletePath = `/delete/${qiniuEntry(oss, objectKey)}`

  return fetch(`https://rs.qiniu.com${deletePath}`, {
    method: 'POST',
    headers: {
      Authorization: createQiniuManageAuthorization(oss, deletePath)
    }
  })
}

function createQiniuUploadToken(objectKey: string, oss: OssConfig) {
  const config = useRuntimeConfig()
  const expires = Number(config.public.downloadUrlExpiresSeconds || 600)
  const policy = base64Url(JSON.stringify({
    scope: `${oss.bucket}:${objectKey}`,
    deadline: Math.floor(Date.now() / 1000) + expires
  }))
  const signature = base64Url(createHmac('sha1', oss.accessKeySecret).update(policy).digest())

  return `${oss.accessKeyId}:${signature}:${policy}`
}

function createQiniuUploadUrl(oss: OssConfig) {
  const endpoint = normalizeEndpoint(oss)

  return `https://${endpoint || 'upload.qiniup.com'}`
}

function createQiniuManageAuthorization(oss: OssConfig, pathWithQuery: string) {
  const signingStr = `${pathWithQuery}\n`
  const signature = base64Url(createHmac('sha1', oss.accessKeySecret).update(signingStr).digest())

  return `QBox ${oss.accessKeyId}:${signature}`
}

function qiniuEntry(oss: OssConfig, objectKey: string) {
  return base64Url(`${oss.bucket}:${objectKey}`)
}

function createObjectUrl(objectKey: string, oss: OssConfig) {
  if (oss.publicBaseUrl) {
    const objectUrl = `${oss.publicBaseUrl.replace(/\/$/, '')}/${encodeObjectPath(objectKey)}`

    return normalizeStorageProvider(oss.provider) === 'upyun_uss'
      ? createUpyunCdnTokenUrl(objectUrl, oss)
      : objectUrl
  }

  const provider = normalizeStorageProvider(oss.provider)

  if (provider === 'tencent_cos') {
    return `https://${oss.bucket}.${normalizeEndpoint(oss) || `cos.${oss.region}.myqcloud.com`}/${encodeObjectPath(objectKey)}`
  }

  if (provider === 'aws_s3') {
    return `https://${oss.bucket}.${normalizeEndpoint(oss) || `s3.${oss.region}.amazonaws.com`}/${encodeObjectPath(objectKey)}`
  }

  if (provider === 'upyun_uss') {
    return `https://${normalizeEndpoint(oss)}/${oss.bucket}/${encodeObjectPath(objectKey)}`
  }

  if (provider === 'qiniu_kodo') {
    if (!oss.publicBaseUrl) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Qiniu Kodo public base URL is required for signed downloads'
      })
    }

    return `https://${oss.bucket}.${normalizeEndpoint(oss)}/${encodeObjectPath(objectKey)}`
  }

  return `https://${oss.bucket}.${normalizeEndpoint(oss) || `${oss.region}.aliyuncs.com`}/${encodeObjectPath(objectKey)}`
}

function createUpyunCdnTokenUrl(objectUrl: string, oss: OssConfig) {
  if (!oss.cdnAuthToken) {
    return objectUrl
  }

  const config = useRuntimeConfig()
  const expires = Number(config.public.downloadUrlExpiresSeconds || 600)
  const expiresAt = Math.floor(Date.now() / 1000) + expires
  const url = new URL(objectUrl)
  const pathname = decodeUrlPathname(url.pathname)
  const signature = createHash('md5')
    .update(`${oss.cdnAuthToken}&${expiresAt}&${pathname}`)
    .digest('hex')
    .slice(12, 20)

  url.searchParams.set('_upt', `${signature}${expiresAt}`)

  return url.toString()
}

function decodeUrlPathname(pathname: string) {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

function normalizeEndpoint(oss: Pick<OssConfig, 'endpoint' | 'region'>) {
  return (oss.endpoint || defaultEndpoint(normalizeStorageProvider((oss as OssConfig).provider), oss.region))
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
}

function defaultEndpoint(provider: StorageProvider, region: string) {
  if (provider === 'aliyun_oss') {
    return `${region}.aliyuncs.com`
  }

  if (provider === 'tencent_cos') {
    return `cos.${region}.myqcloud.com`
  }

  if (provider === 'aws_s3') {
    return `s3.${region}.amazonaws.com`
  }

  if (provider === 'upyun_uss') {
    return 's3.api.upyun.com'
  }

  return 'upload.qiniup.com'
}

function s3SigningRegion(oss: OssConfig) {
  return normalizeStorageProvider(oss.provider) === 'upyun_uss'
    ? 'us-east-1'
    : oss.region
}

function encodeObjectPath(objectKey: string) {
  return objectKey.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

function normalizePathname(pathname: string) {
  return pathname.split('/').map((segment, index) => index === 0 ? '' : rfc3986(decodeURIComponent(segment))).join('/')
}

function canonicalQueryString(params: URLSearchParams) {
  return Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${rfc3986(key)}=${rfc3986(value)}`)
    .join('&')
}

function rfc3986(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function sha1Hex(value: string) {
  return createHash('sha1').update(value).digest('hex')
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function hmacHex(algorithm: 'sha1' | 'sha256', key: string | Buffer, value: string) {
  return createHmac(algorithm, key).update(value).digest('hex')
}

function getAwsSigningKey(secret: string, dateStamp: string, region: string, service: string) {
  const kDate = createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest()
  const kRegion = createHmac('sha256', kDate).update(region).digest()
  const kService = createHmac('sha256', kRegion).update(service).digest()

  return createHmac('sha256', kService).update('aws4_request').digest()
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}
