import { asc, desc, eq } from 'drizzle-orm'
import { appVersions } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const appId = parseIntegerParam(getRouterParam(event, 'appId'), 'appId')
  await getAppById(appId)

  const db = useDb()
  const items = await db.query.appVersions.findMany({
    where: eq(appVersions.appId, appId),
    orderBy: [desc(appVersions.versionNormalized), asc(appVersions.channel)]
  })

  return {
    items,
    total: items.length
  }
})
