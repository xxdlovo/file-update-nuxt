export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const version = await getFileVersionById(id)

  const result = await publishFileVersion(version)

  await writeAuditLog(event, {
    action: 'file_version.rollback',
    resourceType: 'file_version',
    resourceId: version.id,
    metadata: {
      fileProjectId: version.fileProjectId,
      version: version.version,
      channel: version.channel,
      environment: version.environment
    }
  })

  return result
})
