export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const version = await getFileVersionById(id)
  const body = await readBody<{
    fileName?: string
    contentType?: string
    storageConfigId?: number
  }>(event)

  if (!body.fileName?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File name is required'
    })
  }

  const oss = await resolveUploadStorageConfig(body.storageConfigId ? Number(body.storageConfigId) : undefined)
  const objectKey = createFileReleaseObjectKey({
    fileSlug: version.project.slug,
    version: version.version,
    channel: version.channel,
    environment: version.environment,
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
