import { eq } from 'drizzle-orm'
import { storageConfigs } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const id = parseIntegerParam(getRouterParam(event, 'id'))
  const config = await getStorageConfigRecord(id)
  const result = await verifyAliyunOssConfig(config)
  const now = new Date().toISOString()
  const db = useDb()
  const [updated] = await db.update(storageConfigs)
    .set({
      verified: result.ok,
      verifiedAt: result.ok ? now : null,
      lastVerifyStatus: result.ok ? 'success' : 'failed',
      lastVerifyMessage: result.message,
      updatedAt: now
    })
    .where(eq(storageConfigs.id, id))
    .returning()

  return {
    ...sanitizeStorageConfig(updated),
    verifyResult: result
  }
})
