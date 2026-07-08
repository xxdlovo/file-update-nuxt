import { eq } from 'drizzle-orm'
import { fileVersions } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const version = await getFileVersionById(id)
  const body = await readBody<{
    deleteObject?: boolean
    confirmObjectKey?: string
  }>(event) || {}

  const db = useDb()
  const hasUploadedObject = Boolean(version.fileName && version.objectKey && version.size > 0)

  if (body.deleteObject && hasUploadedObject) {
    if (body.confirmObjectKey !== version.objectKey) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Object key confirmation is required before deleting storage object'
      })
    }

    await deleteStoredObject(version.objectKey, version.storageConfigId)
  }

  const [deleted] = await db.delete(fileVersions)
    .where(eq(fileVersions.id, id))
    .returning()

  await writeAuditLog(event, {
    action: 'file_version.delete',
    resourceType: 'file_version',
    resourceId: deleted.id,
    metadata: {
      fileProjectId: deleted.fileProjectId,
      version: deleted.version,
      channel: deleted.channel,
      environment: deleted.environment,
      objectKey: deleted.objectKey,
      deleteObject: Boolean(body.deleteObject && hasUploadedObject)
    }
  })

  return deleted
})
