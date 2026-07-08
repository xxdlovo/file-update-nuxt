import { eq } from 'drizzle-orm'
import { appVersions, updateFiles } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  await getAppVersionById(id)
  const body = await readBody<{
    deleteObjects?: boolean
    confirmObjectKeys?: string[]
  }>(event) || {}

  const db = useDb()
  const files = await db.query.updateFiles.findMany({
    where: eq(updateFiles.versionId, id)
  })

  if (body.deleteObjects) {
    const objectKeys = files.map(file => file.objectKey).filter(Boolean)
    const confirmedKeys = body.confirmObjectKeys || []

    if (
      objectKeys.length !== confirmedKeys.length
      || objectKeys.some(objectKey => !confirmedKeys.includes(objectKey))
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Object key confirmation is required before deleting storage objects'
      })
    }

    for (const file of files) {
      await deleteStoredObject(file.objectKey, file.storageConfigId)
    }
  }

  const [deleted] = await db.delete(appVersions)
    .where(eq(appVersions.id, id))
    .returning()

  await writeAuditLog(event, {
    action: 'app_version.delete',
    resourceType: 'app_version',
    resourceId: deleted.id,
    metadata: {
      appId: deleted.appId,
      version: deleted.version,
      channel: deleted.channel,
      deleteObjects: Boolean(body.deleteObjects),
      objectKeys: files.map(file => file.objectKey)
    }
  })

  return deleted
})
