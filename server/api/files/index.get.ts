import { asc, count, desc, eq } from 'drizzle-orm'
import { fileProjects } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const query = getQuery(event)
  const search = String(query.q || '').trim()
  const includeDisabled = query.includeDisabled === 'true'
  const db = useDb()
  const where = search
    ? buildFileProjectSearchWhere(search)
    : includeDisabled
        ? undefined
        : eq(fileProjects.enabled, true)

  const [totalRow] = await db.select({ total: count() }).from(fileProjects).where(where)
  const items = await db.query.fileProjects.findMany({
    where,
    orderBy: [desc(fileProjects.updatedAt), asc(fileProjects.name)]
  })

  return {
    items,
    total: totalRow?.total || 0
  }
})

