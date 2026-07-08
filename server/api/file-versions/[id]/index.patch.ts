import { eq } from 'drizzle-orm'
import { fileVersions } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const existing = await getFileVersionById(id)
  const body = await readBody<{
    version?: string
    channel?: string
    environment?: string
    status?: string
    releaseNotes?: string | null
    visibility?: string
  }>(event)
  const values: Partial<typeof fileVersions.$inferInsert> = {
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

  if (typeof body.channel === 'string') {
    values.channel = body.channel.trim() || existing.project.defaultChannel
  }

  if (typeof body.environment === 'string') {
    values.environment = body.environment.trim() || 'prod'
  }

  if (typeof body.status === 'string') {
    values.status = normalizeFileVersionStatus(body.status)
  }

  if ('releaseNotes' in body) {
    values.releaseNotes = body.releaseNotes?.trim() || null
  }

  if (typeof body.visibility === 'string') {
    if (!['signed', 'public'].includes(body.visibility)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid visibility' })
    }

    values.visibility = body.visibility
  }

  const db = useDb()

  try {
    const [updated] = await db.update(fileVersions)
      .set(values)
      .where(eq(fileVersions.id, id))
      .returning()

    return updated
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'File version already exists for this channel and environment'
    })
  }
})

