export default defineEventHandler(async (event) => {
  const fileSlug = getRouterParam(event, 'fileSlug') || ''
  const query = getQuery(event)
  const project = await getEnabledFileProjectBySlug(fileSlug)

  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File project not found'
    })
  }

  const channel = String(query.channel || project.defaultChannel)
  const environment = String(query.env || query.environment || 'prod')
  const token = typeof query.token === 'string' ? query.token : ''
  const release = await getActiveFileRelease({
    fileProjectId: project.id,
    channel,
    environment
  })

  if (!release) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Release not found'
    })
  }

  await recordFileVersionDownload({
    version: release.version,
    event,
    source: 'api',
    tokenProvided: Boolean(token)
  })

  return {
    downloadUrl: await createSignedDownloadUrl(release.version.objectKey, release.version.storageConfigId),
    fileName: release.version.fileName,
    size: release.version.size,
    sha256: release.version.sha256,
    mimeType: release.version.mimeType,
    tokenRequired: false,
    tokenProvided: Boolean(token)
  }
})
