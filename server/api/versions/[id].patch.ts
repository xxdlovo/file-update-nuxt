import { eq } from 'drizzle-orm'
import { appVersions } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const existing = await getAppVersionById(id)
  const body = await readBody<{
    version?: string
    buildNumber?: string | null
    channel?: string
    status?: string
    forceUpdate?: boolean
    releaseNotes?: string | null
  }>(event)

  const values: Partial<typeof appVersions.$inferInsert> = {
    updatedAt: new Date().toISOString()
  }

  if (typeof body.version === 'string') {
    const version = body.version.trim()

    if (!version) {
      throw createError({ statusCode: 400, statusMessage: 'Version is required' })
    }

    values.version = version
    values.versionNormalized = normalizeVersion(version)
  }

  if ('buildNumber' in body) {
    values.buildNumber = body.buildNumber?.trim() || null
  }

  if (typeof body.channel === 'string') {
    values.channel = body.channel.trim() || existing.app.defaultChannel
  }

  if (typeof body.status === 'string') {
    values.status = normalizeVersionStatus(body.status)
  }

  if (typeof body.forceUpdate === 'boolean') {
    values.forceUpdate = body.forceUpdate
  }

  if ('releaseNotes' in body) {
    values.releaseNotes = body.releaseNotes?.trim() || null
  }

  const db = useDb()

  try {
    const [updated] = await db.update(appVersions)
      .set(values)
      .where(eq(appVersions.id, id))
      .returning()

    return updated
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'Version already exists in this channel'
    })
  }
})
