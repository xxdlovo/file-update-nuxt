import { eq } from 'drizzle-orm'
import { fileVersions } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  await getFileVersionById(id)
  const body = await readBody<{
    fileName?: string
    objectKey?: string
    bucket?: string
    endpoint?: string | null
    size?: number
    sha256?: string
    mimeType?: string
    storageConfigId?: number | null
  }>(event)

  if (!body.objectKey || !body.fileName || !body.size) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File object information is required'
    })
  }

  const oss = body.storageConfigId
    ? await getStorageConfigById(Number(body.storageConfigId))
    : requireOssConfig()
  const db = useDb()
  const [updated] = await db.update(fileVersions)
    .set({
      storageConfigId: body.storageConfigId ? Number(body.storageConfigId) : null,
      fileName: body.fileName,
      objectKey: body.objectKey,
      bucket: body.bucket || oss.bucket,
      endpoint: body.endpoint || oss.endpoint || null,
      size: Number(body.size),
      sha256: body.sha256 || null,
      mimeType: body.mimeType || null,
      updatedAt: new Date().toISOString()
    })
    .where(eq(fileVersions.id, id))
    .returning()

  await writeAuditLog(event, {
    action: 'file_version.upload',
    resourceType: 'file_version',
    resourceId: updated.id,
    metadata: {
      fileProjectId: updated.fileProjectId,
      version: updated.version,
      fileName: updated.fileName,
      objectKey: updated.objectKey
    }
  })

  return updated
})
