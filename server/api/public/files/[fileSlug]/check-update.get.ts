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
  const currentVersion = typeof query.version === 'string' ? query.version : ''
  const release = await getActiveFileRelease({
    fileSlug,
    channel,
    environment
  })

  if (!release) {
    return {
      updateAvailable: false,
      reason: 'No active release'
    }
  }

  const currentNormalized = currentVersion ? normalizeVersion(currentVersion) : ''
  const updateAvailable = !currentNormalized || release.version.versionNormalized > currentNormalized
  const downloadUrl = updateAvailable
    ? await createSignedDownloadUrl(release.version.objectKey, release.version.storageConfigId)
    : ''

  return {
    updateAvailable,
    tokenRequired: false,
    tokenProvided: Boolean(token),
    latest: updateAvailable
      ? serializePublicFileVersion(release.version, downloadUrl)
      : null
  }
})
