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
  const versionParam = String(query.version || '').trim()

  if (versionParam) {
    const version = await getPublicFileVersion({
      fileProjectId: project.id,
      channel,
      environment,
      version: versionParam
    })

    if (!version) {
      throw createError({
        statusCode: 404,
        statusMessage: 'File version not found'
      })
    }

    await recordFileVersionDownload({
      version,
      event,
      source: 'share'
    })

    const versionDownloadUrl = await createSignedDownloadUrl(version.objectKey, version.storageConfigId)

    return sendRedirect(event, versionDownloadUrl, 302)
  }

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

  if (release.version.visibility !== 'public') {
    throw createError({
      statusCode: 403,
      statusMessage: 'File version is not public'
    })
  }

  await recordFileVersionDownload({
    version: release.version,
    event,
    source: 'share'
  })

  const downloadUrl = await createSignedDownloadUrl(release.version.objectKey, release.version.storageConfigId)

  return sendRedirect(event, downloadUrl, 302)
})
