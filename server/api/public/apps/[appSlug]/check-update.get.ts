export default defineEventHandler(async (event) => {
  const appSlug = getRouterParam(event, 'appSlug') || ''
  const query = getQuery(event)
  const app = await getEnabledAppBySlug(appSlug)

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Application not found'
    })
  }

  const channel = String(query.channel || app.defaultChannel)
  const platform = String(query.platform || '')
  const arch = String(query.arch || 'x64')
  const currentVersion = typeof query.version === 'string' ? query.version : ''

  if (!platform) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Platform is required'
    })
  }

  const release = await getActiveAppRelease({
    appId: app.id,
    channel,
    platform,
    arch
  })

  if (!release) {
    await recordAppUpdateCheck({
      appId: app.id,
      channel,
      platform,
      arch,
      currentVersion,
      updateAvailable: false,
      event,
      source: 'api'
    })

    return {
      updateAvailable: false,
      reason: 'No active release'
    }
  }

  const currentNormalized = currentVersion ? normalizeVersion(currentVersion) : ''
  const updateAvailable = !currentNormalized || release.version.versionNormalized > currentNormalized

  const files = updateAvailable
    ? await Promise.all(release.files.map(async file => ({
        id: file.id,
        platform: file.platform,
        arch: file.arch,
        packageType: file.packageType,
        fileName: file.fileName,
        size: file.size,
        sha256: file.sha256,
        sha512: file.sha512,
        mimeType: file.mimeType,
        downloadUrl: await createSignedDownloadUrl(file.objectKey, file.storageConfigId)
      })))
    : []

  await recordAppUpdateCheck({
    appId: app.id,
    versionId: release.version.id,
    channel,
    platform,
    arch,
    currentVersion,
    updateAvailable,
    filesIssued: files.length,
    event,
    source: 'api'
  })

  return {
    updateAvailable,
    version: release.version.version,
    buildNumber: release.version.buildNumber,
    channel: release.version.channel,
    forceUpdate: release.version.forceUpdate,
    releaseNotes: release.version.releaseNotes,
    publishedAt: release.publishedAt,
    files
  }
})
