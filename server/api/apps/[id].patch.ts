import { eq } from 'drizzle-orm'
import { apps } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  await getAppById(id)

  const body = await readBody<{
    name?: string
    slug?: string
    bundleId?: string
    defaultChannel?: string
    enabled?: boolean
    description?: string | null
  }>(event)

  const values: Partial<typeof apps.$inferInsert> = {
    updatedAt: new Date().toISOString()
  }

  if (typeof body.name === 'string') {
    const name = body.name.trim()

    if (!name) {
      throw createError({ statusCode: 400, statusMessage: 'Application name is required' })
    }

    values.name = name
  }

  if (typeof body.slug === 'string') {
    const slug = normalizeSlug(body.slug)

    if (!slug) {
      throw createError({ statusCode: 400, statusMessage: 'Application slug is required' })
    }

    values.slug = slug
  }

  if (typeof body.bundleId === 'string') {
    const bundleId = body.bundleId.trim()

    if (!bundleId) {
      throw createError({ statusCode: 400, statusMessage: 'Bundle ID is required' })
    }

    values.bundleId = bundleId
  }

  if (typeof body.defaultChannel === 'string') {
    values.defaultChannel = body.defaultChannel.trim() || 'latest'
  }

  if (typeof body.enabled === 'boolean') {
    values.enabled = body.enabled
  }

  if ('description' in body) {
    values.description = body.description?.trim() || null
  }

  const db = useDb()

  try {
    const [app] = await db.update(apps)
      .set(values)
      .where(eq(apps.id, id))
      .returning()

    await writeAuditLog(event, {
      action: 'app.update',
      resourceType: 'app',
      resourceId: app.id,
      metadata: {
        slug: app.slug,
        changed: Object.keys(values).filter(key => key !== 'updatedAt')
      }
    })

    return app
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'Application slug or bundle ID already exists'
    })
  }
})
