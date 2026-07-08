import { eq } from 'drizzle-orm'
import { fileProjects } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  await getFileProjectById(id)

  const db = useDb()
  const [project] = await db.update(fileProjects)
    .set({
      enabled: false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(fileProjects.id, id))
    .returning()

  await writeAuditLog(event, {
    action: 'file_project.disable',
    resourceType: 'file_project',
    resourceId: project.id,
    metadata: {
      slug: project.slug
    }
  })

  return project
})
