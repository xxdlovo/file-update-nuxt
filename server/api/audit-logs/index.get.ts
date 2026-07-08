import { and, count, desc, eq, like, or } from 'drizzle-orm'
import { auditLogs } from '../../../db/schema'

function clampPage(value: unknown) {
  const page = Number(value || 1)

  if (!Number.isFinite(page) || page < 1) {
    return 1
  }

  return Math.floor(page)
}

function clampPageSize(value: unknown) {
  const pageSize = Number(value || 20)

  if (!Number.isFinite(pageSize)) {
    return 20
  }

  return Math.min(Math.max(Math.floor(pageSize), 10), 100)
}

function parseMetadata(value: string | null) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return { raw: value }
  }
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const query = getQuery(event)
  const search = String(query.q || '').trim()
  const action = String(query.action || '').trim()
  const actionPrefix = String(query.actionPrefix || '').trim()
  const resourceType = String(query.resourceType || '').trim()
  const page = clampPage(query.page)
  const pageSize = clampPageSize(query.pageSize)
  const filters = []

  if (search) {
    const value = `%${search}%`
    filters.push(or(
      like(auditLogs.action, value),
      like(auditLogs.resourceType, value),
      like(auditLogs.resourceId, value),
      like(auditLogs.metadata, value)
    ))
  }

  if (action) {
    filters.push(eq(auditLogs.action, action))
  }

  if (actionPrefix) {
    filters.push(like(auditLogs.action, `${actionPrefix}.%`))
  }

  if (resourceType) {
    filters.push(eq(auditLogs.resourceType, resourceType))
  }

  const where = filters.length ? and(...filters) : undefined
  const db = useDb()
  const [totalRow] = await db.select({ total: count() }).from(auditLogs).where(where)
  const rows = await db.query.auditLogs.findMany({
    where,
    orderBy: [desc(auditLogs.createdAt), desc(auditLogs.id)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  })

  return {
    items: rows.map(row => ({
      ...row,
      metadata: parseMetadata(row.metadata)
    })),
    total: totalRow?.total || 0,
    page,
    pageSize
  }
})
