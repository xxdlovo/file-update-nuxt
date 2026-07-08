import { storageConfigs } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const body = await readBody(event)
  const values = normalizeStorageConfigInput(body)
  const db = useDb()

  try {
    const [created] = await db.insert(storageConfigs).values(values).returning()

    return sanitizeStorageConfig(created)
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'Storage config name already exists'
    })
  }
})
