import { asc, desc, eq } from 'drizzle-orm'
import { fileVersions } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const projectId = parseIntegerParam(getRouterParam(event, 'projectId'), 'projectId')
  await getFileProjectById(projectId)

  const db = useDb()
  const items = await db.query.fileVersions.findMany({
    where: eq(fileVersions.fileProjectId, projectId),
    orderBy: [desc(fileVersions.versionNormalized), asc(fileVersions.channel), asc(fileVersions.environment)]
  })

  return {
    items,
    total: items.length
  }
})

