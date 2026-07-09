import { and, count, desc, eq, gte, sql, sum } from 'drizzle-orm'
import { appUpdateCheckEvents, appVersions } from '../../../../db/schema'

function toNumber(value: unknown) {
  return Number(value || 0)
}

function getSinceDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days + 1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const appId = parseIntegerParam(getRouterParam(event, 'appId'), 'appId')
  const query = getQuery(event)
  const days = Math.min(Math.max(Number(query.days || 14), 7), 90)
  const since = getSinceDate(days)
  const lastSevenSince = getSinceDate(7)

  await getAppById(appId)

  const db = useDb()

  const [
    [summary],
    [lastSeven],
    dailyRows,
    versionRows,
    sourceRows,
    recentRows
  ] = await Promise.all([
    db.select({
      totalChecks: count(),
      updateAvailableChecks: sql<number>`sum(case when ${appUpdateCheckEvents.updateAvailable} then 1 else 0 end)`,
      downloadLinksIssued: sum(appUpdateCheckEvents.filesIssued),
      uniqueCheckers: sql<number>`count(distinct ${appUpdateCheckEvents.ipHash})`
    })
      .from(appUpdateCheckEvents)
      .where(eq(appUpdateCheckEvents.appId, appId)),
    db.select({ total: count() })
      .from(appUpdateCheckEvents)
      .where(and(
        eq(appUpdateCheckEvents.appId, appId),
        gte(appUpdateCheckEvents.createdAt, lastSevenSince)
      )),
    db.select({
      date: sql<string>`date(${appUpdateCheckEvents.createdAt})`,
      checks: count(),
      downloadLinksIssued: sum(appUpdateCheckEvents.filesIssued)
    })
      .from(appUpdateCheckEvents)
      .where(and(
        eq(appUpdateCheckEvents.appId, appId),
        gte(appUpdateCheckEvents.createdAt, since)
      ))
      .groupBy(sql`date(${appUpdateCheckEvents.createdAt})`)
      .orderBy(sql`date(${appUpdateCheckEvents.createdAt})`),
    db.select({
      versionId: appUpdateCheckEvents.appVersionId,
      version: appVersions.version,
      channel: appVersions.channel,
      checks: count(),
      downloadLinksIssued: sum(appUpdateCheckEvents.filesIssued)
    })
      .from(appUpdateCheckEvents)
      .leftJoin(appVersions, eq(appUpdateCheckEvents.appVersionId, appVersions.id))
      .where(eq(appUpdateCheckEvents.appId, appId))
      .groupBy(
        appUpdateCheckEvents.appVersionId,
        appVersions.version,
        appVersions.channel
      )
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db.select({
      source: appUpdateCheckEvents.source,
      checks: count(),
      downloadLinksIssued: sum(appUpdateCheckEvents.filesIssued)
    })
      .from(appUpdateCheckEvents)
      .where(eq(appUpdateCheckEvents.appId, appId))
      .groupBy(appUpdateCheckEvents.source)
      .orderBy(desc(sql`count(*)`)),
    db.query.appUpdateCheckEvents.findMany({
      where: eq(appUpdateCheckEvents.appId, appId),
      orderBy: [desc(appUpdateCheckEvents.createdAt)],
      limit: 10,
      with: {
        version: true
      }
    })
  ])

  const dailyMap = new Map(dailyRows.map(row => [row.date, {
    checks: toNumber(row.checks),
    downloadLinksIssued: toNumber(row.downloadLinksIssued)
  }]))
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(since)
    date.setDate(date.getDate() + index)
    const key = date.toISOString().slice(0, 10)
    const item = dailyMap.get(key)

    return {
      date: key,
      checks: item?.checks || 0,
      downloadLinksIssued: item?.downloadLinksIssued || 0
    }
  })

  return {
    rangeDays: days,
    summary: {
      totalChecks: toNumber(summary?.totalChecks),
      updateAvailableChecks: toNumber(summary?.updateAvailableChecks),
      downloadLinksIssued: toNumber(summary?.downloadLinksIssued),
      uniqueCheckers: toNumber(summary?.uniqueCheckers),
      lastSevenChecks: toNumber(lastSeven?.total)
    },
    daily,
    versions: versionRows.map(row => ({
      versionId: row.versionId,
      version: row.version || '-',
      channel: row.channel || '-',
      checks: toNumber(row.checks),
      downloadLinksIssued: toNumber(row.downloadLinksIssued)
    })),
    sources: sourceRows.map(row => ({
      source: row.source,
      checks: toNumber(row.checks),
      downloadLinksIssued: toNumber(row.downloadLinksIssued)
    })),
    recent: recentRows.map(row => ({
      id: row.id,
      versionId: row.appVersionId,
      version: row.version?.version || '-',
      channel: row.channel,
      platform: row.platform,
      arch: row.arch,
      currentVersion: row.currentVersion,
      updateAvailable: row.updateAvailable,
      filesIssued: row.filesIssued,
      source: row.source,
      referer: row.referer,
      createdAt: row.createdAt
    }))
  }
})
