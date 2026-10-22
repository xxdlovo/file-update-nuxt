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
  // direct=1：直接 302 到对象存储/CDN 签名地址，不经过服务端中转
  const direct = ['1', 'true', 'yes'].includes(String(query.direct || '').toLowerCase())

  async function respondWithVersion(version: NonNullable<Awaited<ReturnType<typeof getPublicFileVersion>>>) {
    await recordFileVersionDownload({
      version,
      event,
      source: 'share'
    })

    const downloadUrl = await createSignedDownloadUrl(version.objectKey, version.storageConfigId)

    if (direct) {
      return sendRedirect(event, downloadUrl, 302)
    }

    return streamFileDownload(event, {
      url: downloadUrl,
      fileName: version.fileName,
      mimeType: version.mimeType,
      sha256: version.sha256,
      size: version.size
    })
  }

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

    return respondWithVersion(version)
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

  return respondWithVersion(release.version)
})
