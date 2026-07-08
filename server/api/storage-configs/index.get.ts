export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const query = getQuery(event)
  const verifiedOnly = query.verified === 'true'
  const db = useDb()
  const items = await db.query.storageConfigs.findMany({
    where: (table, { and, eq }) => verifiedOnly
      ? and(eq(table.enabled, true), eq(table.verified, true))
      : undefined,
    orderBy: (table, { desc }) => [desc(table.updatedAt)]
  })

  return {
    items: items.map(sanitizeStorageConfig),
    total: items.length
  }
})
