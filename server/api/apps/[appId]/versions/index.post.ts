import { appVersions } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const appId = parseIntegerParam(getRouterParam(event, 'appId'), 'appId')
  const app = await getAppById(appId)
  const body = await readBody<{
    version?: string
    buildNumber?: string
    channel?: string
    forceUpdate?: boolean
    releaseNotes?: string
  }>(event)

  const version = body.version?.trim()

  if (!version) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Version is required'
    })
  }

  const db = useDb()
  const versionNormalized = normalizeVersion(version)

  try {
    const [created] = await db.insert(appVersions).values({
      appId: app.id,
      version,
      versionNormalized,
      buildNumber: body.buildNumber?.trim() || null,
      channel: body.channel?.trim() || app.defaultChannel,
      status: 'draft',
      forceUpdate: body.forceUpdate ?? false,
      releaseNotes: body.releaseNotes?.trim() || null
    }).returning()

    await writeAuditLog(event, {
      action: 'app_version.create',
      resourceType: 'app_version',
      resourceId: created.id,
      metadata: {
        appId: app.id,
        version: created.version,
        channel: created.channel
      }
    })

    return created
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'Version already exists in this channel'
    })
  }
})
