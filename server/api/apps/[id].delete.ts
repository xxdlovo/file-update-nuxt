import { eq } from 'drizzle-orm'
import { apps } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  await getAppById(id)

  const db = useDb()
  const [app] = await db.update(apps)
    .set({
      enabled: false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(apps.id, id))
    .returning()

  return app
})
