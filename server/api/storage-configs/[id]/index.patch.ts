import { eq } from 'drizzle-orm'
import { storageConfigs } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const existing = await getStorageConfigRecord(id)
  const body = await readBody(event)
  const accessKeyId = typeof body.accessKeyId === 'string' && body.accessKeyId.includes('*')
    ? existing.accessKeyId
    : body.accessKeyId
  const values = normalizeStorageConfigInput({
    ...existing,
    ...body,
    accessKeyId,
    accessKeySecret: body.accessKeySecret?.trim() || existing.accessKeySecret
  })
  const db = useDb()

  try {
    const [updated] = await db.update(storageConfigs)
      .set({
        ...values,
        verified: false,
        verifiedAt: null,
        lastVerifyStatus: 'pending',
        lastVerifyMessage: 'Configuration changed, verification required',
        updatedAt: new Date().toISOString()
      })
      .where(eq(storageConfigs.id, id))
      .returning()

    return sanitizeStorageConfig(updated)
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'Storage config name already exists'
    })
  }
})
