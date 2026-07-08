import { eq } from 'drizzle-orm'
import { updateFiles } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const db = useDb()
  const existing = await db.query.updateFiles.findFirst({
    where: eq(updateFiles.id, id)
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File not found'
    })
  }

  const [deleted] = await db.delete(updateFiles)
    .where(eq(updateFiles.id, id))
    .returning()

  return deleted
})
