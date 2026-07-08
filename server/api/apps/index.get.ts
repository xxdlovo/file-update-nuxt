import { asc, count, desc, eq } from 'drizzle-orm'
import { apps } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const query = getQuery(event)
  const search = String(query.q || '').trim()
  const includeDisabled = query.includeDisabled === 'true'
  const db = useDb()
  const where = search
    ? buildAppSearchWhere(search)
    : includeDisabled
        ? undefined
        : eq(apps.enabled, true)

  const [totalRow] = await db.select({ total: count() }).from(apps).where(where)
  const items = await db.query.apps.findMany({
    where,
    orderBy: [desc(apps.updatedAt), asc(apps.name)]
  })

  return {
    items,
    total: totalRow?.total || 0
  }
})
