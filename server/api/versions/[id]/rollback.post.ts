export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const version = await getAppVersionById(id)

  const result = await publishAppVersion(version)

  await writeAuditLog(event, {
    action: 'app_version.rollback',
    resourceType: 'app_version',
    resourceId: version.id,
    metadata: {
      appId: version.appId,
      version: version.version,
      channel: version.channel
    }
  })

  return result
})
