export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const body = await readBody<{
    versionId?: number
    fileName?: string
    platform?: string
    arch?: string
    packageType?: string
    contentType?: string
    storageConfigId?: number
  }>(event)

  assertUploadTarget(body)

  if (!body.versionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Version ID is required'
    })
  }

  if (!body.fileName?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File name is required'
    })
  }

  const version = await getAppVersionById(Number(body.versionId))
  const oss = await resolveUploadStorageConfig(body.storageConfigId ? Number(body.storageConfigId) : undefined)
  const objectKey = createUpdateObjectKey({
    appSlug: version.app.slug,
    version: version.version,
    platform: body.platform!,
    arch: body.arch!,
    packageType: body.packageType!,
    fileName: body.fileName
  }, oss)
  const contentType = body.contentType || 'application/octet-stream'
  const uploadRequest = createSignedUploadRequest(objectKey, contentType, oss)

  return {
    method: uploadRequest.method,
    uploadUrl: uploadRequest.uploadUrl,
    objectKey,
    storageConfigId: oss.id || null,
    bucket: oss.bucket,
    endpoint: oss.endpoint,
    headers: uploadRequest.headers,
    fields: uploadRequest.fields
  }
})
