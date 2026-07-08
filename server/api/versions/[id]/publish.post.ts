export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const version = await getAppVersionById(id)
  const body = await readBody<{
    targets?: Array<{
      platform?: string
      arch?: string
    }>
  }>(event) || {}
  const targets = body.targets?.map((target) => {
    if (!target.platform || !target.arch) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid publish target'
      })
    }

    return {
      platform: target.platform,
      arch: target.arch
    }
  })

  const result = await publishAppVersion(version, targets)

  await writeAuditLog(event, {
    action: 'app_version.publish',
    resourceType: 'app_version',
    resourceId: version.id,
    metadata: {
      appId: version.appId,
      version: version.version,
      channel: version.channel,
      targets: targets || 'all'
    }
  })

  return result
})
