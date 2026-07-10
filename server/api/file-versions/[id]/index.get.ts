import { eq } from 'drizzle-orm'
import { fileReleases } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const version = await getFileVersionById(id)
  const db = useDb()
  const releases = await db.query.fileReleases.findMany({
    where: eq(fileReleases.fileVersionId, id)
  })

  return {
    ...version,
    releases
  }
})

