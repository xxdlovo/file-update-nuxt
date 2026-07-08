import { apps } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const body = await readBody<{
    name?: string
    slug?: string
    bundleId?: string
    defaultChannel?: string
    enabled?: boolean
    description?: string
  }>(event)

  const name = body.name?.trim()
  const slug = normalizeSlug(body.slug || body.name || '')
  const bundleId = body.bundleId?.trim()
  const defaultChannel = body.defaultChannel?.trim() || 'latest'

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Application name is required' })
  }

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Application slug is required' })
  }

  if (!bundleId) {
    throw createError({ statusCode: 400, statusMessage: 'Bundle ID is required' })
  }

  const db = useDb()

  try {
    const [app] = await db.insert(apps).values({
      name,
      slug,
      bundleId,
      defaultChannel,
      enabled: body.enabled ?? true,
      description: body.description?.trim() || null
    }).returning()

    await writeAuditLog(event, {
      action: 'app.create',
      resourceType: 'app',
      resourceId: app.id,
      metadata: {
        slug: app.slug,
        bundleId: app.bundleId
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
