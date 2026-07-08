import { fileProjects } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const body = await readBody<{
    name?: string
    slug?: string
    category?: string
    defaultChannel?: string
    enabled?: boolean
    description?: string
  }>(event)

  const name = body.name?.trim()
  const slug = normalizeSlug(body.slug || body.name || '')
  const defaultChannel = body.defaultChannel?.trim() || 'stable'

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Project name is required' })
  }

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Project slug is required' })
  }

  const db = useDb()

  try {
    const [project] = await db.insert(fileProjects).values({
      name,
      slug,
      category: body.category?.trim() || null,
      defaultChannel,
      enabled: body.enabled ?? true,
      description: body.description?.trim() || null
    }).returning()

    await writeAuditLog(event, {
      action: 'file_project.create',
      resourceType: 'file_project',
      resourceId: project.id,
      metadata: {
        slug: project.slug,
        category: project.category
      }
    })

    return project
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'Project slug already exists'
    })
  }
})
