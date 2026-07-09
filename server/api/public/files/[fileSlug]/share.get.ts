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

  const downloadUrl = await createSignedDownloadUrl(release.version.objectKey, release.version.storageConfigId)

  return {
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      category: project.category,
      description: project.description,
      defaultChannel: project.defaultChannel
    },
    version: {
      ...serializePublicFileVersion(release.version, downloadUrl),
      downloadCount: release.version.downloadCount
    },
    release: {
      channel: release.channel,
      environment: release.environment,
      publishedAt: release.publishedAt
    }
  }
})
