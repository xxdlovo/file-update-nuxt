import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'

export function requestAnalytics(event: H3Event) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || ''

  return {
    userAgent: getHeader(event, 'user-agent') || null,
    referer: getHeader(event, 'referer') || null,
    ipAddress: ip || null,
    ipHash: ip ? createHash('sha256').update(ip).digest('hex') : null
  }
}
