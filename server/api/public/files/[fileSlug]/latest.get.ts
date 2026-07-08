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
    fileSlug,
    channel,
    environment
  })

  if (!release) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Release not found'
    })
  }

  const downloadUrl = await createSignedDownloadUrl(release.version.objectKey, release.version.storageConfigId)

  return {
    ...serializePublicFileVersion(release.version, downloadUrl),
    tokenRequired: false,
    tokenProvided: Boolean(token)
  }
})
