import { eq } from 'drizzle-orm'
import { updateFiles } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const body = await readBody<{
    deleteObject?: boolean
    confirmObjectKey?: string
  }>(event) || {}
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

  if (body.deleteObject) {
    if (body.confirmObjectKey !== existing.objectKey) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Object key confirmation is required before deleting OSS object'
      })
    }

    await deleteStoredObject(existing.objectKey, existing.storageConfigId)
  }

  const [deleted] = await db.delete(updateFiles)
    .where(eq(updateFiles.id, id))
    .returning()

  await writeAuditLog(event, {
    action: 'update_file.delete',
    resourceType: 'update_file',
    resourceId: deleted.id,
    metadata: {
      appId: deleted.appId,
      versionId: deleted.versionId,
      fileName: deleted.fileName,
      objectKey: deleted.objectKey,
      deleteObject: Boolean(body.deleteObject)
    }
  })

  return deleted
})
