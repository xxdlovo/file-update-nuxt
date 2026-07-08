import { updateFiles } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const body = await readBody<{
    versionId?: number
    platform?: string
    arch?: string
    packageType?: string
    fileName?: string
    objectKey?: string
    bucket?: string
    endpoint?: string
    size?: number
    sha256?: string
    sha512?: string
    mimeType?: string
    storageConfigId?: number | null
  }>(event)

  assertUploadTarget(body)

  if (!body.versionId || !body.objectKey || !body.fileName || !body.size) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Version, file and object information are required'
    })
  }

  const version = await getAppVersionById(Number(body.versionId))
  const oss = body.storageConfigId
    ? await getStorageConfigById(Number(body.storageConfigId))
    : requireOssConfig()
  const db = useDb()

  try {
    const [file] = await db.insert(updateFiles).values({
      appId: version.appId,
      versionId: version.id,
      storageConfigId: body.storageConfigId ? Number(body.storageConfigId) : null,
      platform: body.platform!,
      arch: body.arch!,
      packageType: body.packageType!,
      fileName: body.fileName,
      objectKey: body.objectKey,
      bucket: body.bucket || oss.bucket,
      endpoint: body.endpoint || oss.endpoint || null,
      size: Number(body.size),
      sha256: body.sha256 || null,
      sha512: body.sha512 || null,
      mimeType: body.mimeType || null
    }).returning()

    return file
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'File object already exists'
    })
  }
})
