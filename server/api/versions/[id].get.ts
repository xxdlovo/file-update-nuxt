import { eq } from 'drizzle-orm'
import { releases as appReleases } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const version = await getAppVersionById(id)
  const db = useDb()
  const releases = await db.query.releases.findMany({
    where: eq(appReleases.versionId, id)
  })

  return {
    ...version,
    releases
  }
})
