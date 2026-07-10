export default defineEventHandler(async (event) => {
  const fileSlug = getRouterParam(event, 'fileSlug') || ''
  const project = await getEnabledFileProjectBySlug(fileSlug)

  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File project not found'
    })
  }

  const created = await recordFileClientEvent(event, project, await readBody(event) || {})

  return {
    ok: true,
    eventId: created?.id || null,
    fileProjectId: project.id,
    versionId: created?.fileVersionId || null
  }
})
