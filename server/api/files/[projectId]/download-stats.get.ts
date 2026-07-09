import { and, count, desc, eq, gte, sql } from 'drizzle-orm'
import { fileDownloadEvents, fileUpdateCheckEvents, fileVersions } from '../../../../db/schema'

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

  const projectId = parseIntegerParam(getRouterParam(event, 'projectId'), 'projectId')
  const query = getQuery(event)
  const days = Math.min(Math.max(Number(query.days || 14), 7), 90)
  const since = getSinceDate(days)
  const lastSevenSince = getSinceDate(7)

  await getFileProjectById(projectId)

  const db = useDb()

  const [
    [summary],
    [lastSeven],
    [checkSummary],
    [lastSevenChecks],
    dailyRows,
    dailyCheckRows,
    versionRows,
    sourceRows,
    checkSourceRows,
    recentRows
  ] = await Promise.all([
    db.select({
      totalDownloads: count(),
      uniqueVisitors: sql<number>`count(distinct ${fileDownloadEvents.ipHash})`
    })
      .from(fileDownloadEvents)
      .where(eq(fileDownloadEvents.fileProjectId, projectId)),
    db.select({ total: count() })
      .from(fileDownloadEvents)
      .where(and(
        eq(fileDownloadEvents.fileProjectId, projectId),
        gte(fileDownloadEvents.createdAt, lastSevenSince)
      )),
    db.select({
      totalChecks: count(),
      updateAvailable: sql<number>`sum(case when ${fileUpdateCheckEvents.updateAvailable} then 1 else 0 end)`,
      uniqueCheckers: sql<number>`count(distinct ${fileUpdateCheckEvents.ipHash})`
    })
      .from(fileUpdateCheckEvents)
      .where(eq(fileUpdateCheckEvents.fileProjectId, projectId)),
    db.select({ total: count() })
      .from(fileUpdateCheckEvents)
      .where(and(
        eq(fileUpdateCheckEvents.fileProjectId, projectId),
        gte(fileUpdateCheckEvents.createdAt, lastSevenSince)
      )),
    db.select({
      date: sql<string>`date(${fileDownloadEvents.createdAt})`,
      downloads: count()
    })
      .from(fileDownloadEvents)
      .where(and(
        eq(fileDownloadEvents.fileProjectId, projectId),
        gte(fileDownloadEvents.createdAt, since)
      ))
      .groupBy(sql`date(${fileDownloadEvents.createdAt})`)
      .orderBy(sql`date(${fileDownloadEvents.createdAt})`),
    db.select({
      date: sql<string>`date(${fileUpdateCheckEvents.createdAt})`,
      checks: count()
    })
      .from(fileUpdateCheckEvents)
      .where(and(
        eq(fileUpdateCheckEvents.fileProjectId, projectId),
        gte(fileUpdateCheckEvents.createdAt, since)
      ))
      .groupBy(sql`date(${fileUpdateCheckEvents.createdAt})`)
      .orderBy(sql`date(${fileUpdateCheckEvents.createdAt})`),
    db.select({
      versionId: fileDownloadEvents.fileVersionId,
      version: fileVersions.version,
      channel: fileVersions.channel,
      environment: fileVersions.environment,
      downloads: count()
    })
      .from(fileDownloadEvents)
      .innerJoin(fileVersions, eq(fileDownloadEvents.fileVersionId, fileVersions.id))
      .where(eq(fileDownloadEvents.fileProjectId, projectId))
      .groupBy(
        fileDownloadEvents.fileVersionId,
        fileVersions.version,
        fileVersions.channel,
        fileVersions.environment
      )
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db.select({
      source: fileDownloadEvents.source,
      downloads: count()
    })
      .from(fileDownloadEvents)
      .where(eq(fileDownloadEvents.fileProjectId, projectId))
      .groupBy(fileDownloadEvents.source)
      .orderBy(desc(sql`count(*)`)),
    db.select({
      source: fileUpdateCheckEvents.source,
      checks: count()
    })
      .from(fileUpdateCheckEvents)
      .where(eq(fileUpdateCheckEvents.fileProjectId, projectId))
      .groupBy(fileUpdateCheckEvents.source)
      .orderBy(desc(sql`count(*)`)),
    db.query.fileDownloadEvents.findMany({
      where: eq(fileDownloadEvents.fileProjectId, projectId),
      orderBy: [desc(fileDownloadEvents.createdAt)],
      limit: 10,
      with: {
        version: true
      }
    })
  ])

  const dailyMap = new Map(dailyRows.map(row => [row.date, toNumber(row.downloads)]))
  const dailyCheckMap = new Map(dailyCheckRows.map(row => [row.date, toNumber(row.checks)]))
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(since)
    date.setDate(date.getDate() + index)
    const key = date.toISOString().slice(0, 10)

    return {
      date: key,
      downloads: dailyMap.get(key) || 0,
      checks: dailyCheckMap.get(key) || 0
    }
  })

  return {
    rangeDays: days,
    summary: {
      totalDownloads: toNumber(summary?.totalDownloads),
      uniqueVisitors: toNumber(summary?.uniqueVisitors),
      lastSevenDays: toNumber(lastSeven?.total),
      totalChecks: toNumber(checkSummary?.totalChecks),
      updateAvailableChecks: toNumber(checkSummary?.updateAvailable),
      uniqueCheckers: toNumber(checkSummary?.uniqueCheckers),
      lastSevenChecks: toNumber(lastSevenChecks?.total)
    },
    daily,
    versions: versionRows.map(row => ({
      versionId: row.versionId,
      version: row.version,
      channel: row.channel,
      environment: row.environment,
      downloads: toNumber(row.downloads)
    })),
    sources: sourceRows.map(row => ({
      source: row.source,
      downloads: toNumber(row.downloads)
    })),
    checkSources: checkSourceRows.map(row => ({
      source: row.source,
      checks: toNumber(row.checks)
    })),
    recent: recentRows.map(row => ({
      id: row.id,
      versionId: row.fileVersionId,
      version: row.version?.version || '-',
      channel: row.channel,
      environment: row.environment,
      source: row.source,
      fileName: row.fileName,
      userAgent: row.userAgent,
      referer: row.referer,
      tokenProvided: row.tokenProvided,
      createdAt: row.createdAt
    }))
  }
})
