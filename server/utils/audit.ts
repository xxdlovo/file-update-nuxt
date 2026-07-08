import type { H3Event } from 'h3'
import { auditLogs } from '../../db/schema'

type AuditInput = {
  action: string
  resourceType: string
  resourceId?: string | number | null
  metadata?: Record<string, unknown> | null
  userId?: number | null
}

export async function writeAuditLog(event: H3Event, input: AuditInput) {
  const db = useDb()
  let userId = input.userId ?? null

  if (userId === null) {
    const session = await getUserSession(event)
    userId = typeof session.user?.id === 'number' ? session.user.id : null
  }

  await db.insert(auditLogs).values({
    userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId == null ? null : String(input.resourceId),
    metadata: input.metadata ? JSON.stringify(input.metadata) : null
  })
}
