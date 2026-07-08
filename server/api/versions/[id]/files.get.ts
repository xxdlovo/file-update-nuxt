import { asc, eq } from 'drizzle-orm'
import { updateFiles } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  await getAppVersionById(id)

  const db = useDb()
  const items = await db.query.updateFiles.findMany({
    where: eq(updateFiles.versionId, id),
    orderBy: [asc(updateFiles.platform), asc(updateFiles.arch), asc(updateFiles.packageType)]
  })

  return {
    items,
    total: items.length
  }
})
