import { eq } from 'drizzle-orm'
import { fileProjects } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const existing = await getFileProjectById(id)
  const body = await readBody<{
    name?: string
    slug?: string
    category?: string | null
    defaultChannel?: string
    enabled?: boolean
    description?: string | null
  }>(event)
  const values: Partial<typeof fileProjects.$inferInsert> = {
    updatedAt: new Date().toISOString()
  }

  if (typeof body.name === 'string') {
    const name = body.name.trim()

    if (!name) {
      throw createError({ statusCode: 400, statusMessage: 'Project name is required' })
    }

    values.name = name
  }

  if (typeof body.slug === 'string') {
    const slug = normalizeSlug(body.slug)

    if (!slug) {
      throw createError({ statusCode: 400, statusMessage: 'Project slug is required' })
    }

    values.slug = slug
  }

  if ('category' in body) {
    values.category = body.category?.trim() || null
  }

  if (typeof body.defaultChannel === 'string') {
    values.defaultChannel = body.defaultChannel.trim() || existing.defaultChannel
  }

  if (typeof body.enabled === 'boolean') {
    values.enabled = body.enabled
  }

  if ('description' in body) {
    values.description = body.description?.trim() || null
  }

  const db = useDb()

  try {
    const [updated] = await db.update(fileProjects)
      .set(values)
      .where(eq(fileProjects.id, id))
      .returning()

    await writeAuditLog(event, {
      action: 'file_project.update',
      resourceType: 'file_project',
      resourceId: updated.id,
      metadata: {
        slug: updated.slug,
        changed: Object.keys(values).filter(key => key !== 'updatedAt')
      }
    })

    return updated
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'Project slug already exists'
    })
  }
})
