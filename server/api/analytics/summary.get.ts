import { and, count, desc, eq, gte, inArray, sql, sum } from 'drizzle-orm'
import { appClientEvents, appClients, appVersions, fileClientEvents, fileClients, fileVersions } from '../../../db/schema'

function startDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - Math.max(days - 1, 0))
  date.setHours(0, 0, 0, 0)

  return date.toISOString()
}

function numberValue(value: unknown) {
  return Number(value || 0)
}

function fillDaily(days: number, rows: Array<{ date: string, events: unknown, startups: unknown, downloads: unknown }>) {
  const byDate = new Map(rows.map(row => [row.date, row]))
  const result = []

  for (let index = days - 1; index >= 0; index--) {
    const date = new Date()
    date.setDate(date.getDate() - index)
    const key = date.toISOString().slice(0, 10)
    const row = byDate.get(key)

    result.push({
      date: key,
      events: numberValue(row?.events),
      startups: numberValue(row?.startups),
      downloads: numberValue(row?.downloads)
    })
  }

  return result
}

function parseMetadata(value: string | null) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const query = getQuery(event)
  const type = query.type === 'file' ? 'file' : 'app'
  const id = parseIntegerParam(String(query.id || ''), 'id')
  const days = Math.min(Math.max(Number(query.days || 14), 1), 90)
  const since = startDate(days)
  const lastSevenSince = startDate(7)
  const db = useDb()

  if (type === 'file') {
    const project = await getFileProjectById(id)
    const where = and(eq(fileClientEvents.fileProjectId, id), gte(fileClientEvents.createdAt, since))
    const [
      [summary],
      [lastSeven],
      dailyRows,
      eventTypeRows,
      versionRows,
      platformRows,
      clientRows,
      recentRows
    ] = await Promise.all([
      db.select({
        totalEvents: count(),
        startupEvents: sql<number>`sum(case when ${fileClientEvents.eventType} in ('startup', 'launch', 'start') then 1 else 0 end)`,
        downloadEvents: sql<number>`sum(case when ${fileClientEvents.eventType} in ('download', 'file_download', 'update_download') then 1 else 0 end)`,
        errorEvents: sql<number>`sum(case when ${fileClientEvents.eventType} in ('error', 'crash', 'exception') then 1 else 0 end)`,
        uniqueClients: sql<number>`count(distinct ${fileClientEvents.clientId})`,
        totalBytes: sum(fileClientEvents.bytes),
        avgStartupMs: sql<number>`avg(${fileClientEvents.startupDurationMs})`
      }).from(fileClientEvents).where(where),
      db.select({ total: count() }).from(fileClientEvents).where(and(
        eq(fileClientEvents.fileProjectId, id),
        gte(fileClientEvents.createdAt, lastSevenSince)
      )),
      db.select({
        date: sql<string>`date(${fileClientEvents.createdAt})`,
        events: count(),
        startups: sql<number>`sum(case when ${fileClientEvents.eventType} in ('startup', 'launch', 'start') then 1 else 0 end)`,
        downloads: sql<number>`sum(case when ${fileClientEvents.eventType} in ('download', 'file_download', 'update_download') then 1 else 0 end)`
      }).from(fileClientEvents).where(where).groupBy(sql`date(${fileClientEvents.createdAt})`).orderBy(sql`date(${fileClientEvents.createdAt})`),
      db.select({ eventType: fileClientEvents.eventType, total: count() })
        .from(fileClientEvents).where(where).groupBy(fileClientEvents.eventType).orderBy(desc(count())),
      db.select({
        versionId: fileClientEvents.fileVersionId,
        version: fileVersions.version,
        channel: fileClientEvents.channel,
        environment: fileClientEvents.environment,
        total: count()
      }).from(fileClientEvents)
        .leftJoin(fileVersions, eq(fileClientEvents.fileVersionId, fileVersions.id))
        .where(where)
        .groupBy(fileClientEvents.fileVersionId, fileVersions.version, fileClientEvents.channel, fileClientEvents.environment)
        .orderBy(desc(count())),
      db.select({ platform: fileClientEvents.platform, arch: fileClientEvents.arch, total: count() })
        .from(fileClientEvents).where(where).groupBy(fileClientEvents.platform, fileClientEvents.arch).orderBy(desc(count())),
      db.query.fileClients.findMany({
        where: eq(fileClients.fileProjectId, id),
        orderBy: [desc(fileClients.lastSeenAt), desc(fileClients.eventCount)],
        limit: 10,
        with: { version: true }
      }),
      db.query.fileClientEvents.findMany({
        where,
        orderBy: [desc(fileClientEvents.createdAt), desc(fileClientEvents.id)],
        limit: 20,
        with: { version: true }
      })
    ])
    const clientIds = clientRows.map(row => row.clientId).filter((value): value is string => Boolean(value))
    const clientEventRows = clientIds.length
      ? await db.query.fileClientEvents.findMany({
          where: and(
            eq(fileClientEvents.fileProjectId, id),
            inArray(fileClientEvents.clientId, clientIds)
          ),
          orderBy: [desc(fileClientEvents.createdAt), desc(fileClientEvents.id)],
          limit: 100,
          with: { version: true }
        })
      : []
    const eventsByClient = new Map<string, typeof clientEventRows>()

    for (const eventRow of clientEventRows) {
      if (!eventRow.clientId) {
        continue
      }

      const rows = eventsByClient.get(eventRow.clientId) || []

      if (rows.length < 5) {
        rows.push(eventRow)
        eventsByClient.set(eventRow.clientId, rows)
      }
    }

    return {
      type,
      target: { id: project.id, name: project.name, slug: project.slug },
      rangeDays: days,
      summary: {
        totalEvents: numberValue(summary?.totalEvents),
        startupEvents: numberValue(summary?.startupEvents),
        downloadEvents: numberValue(summary?.downloadEvents),
        errorEvents: numberValue(summary?.errorEvents),
        uniqueClients: numberValue(summary?.uniqueClients),
        totalBytes: numberValue(summary?.totalBytes),
        avgStartupMs: Math.round(numberValue(summary?.avgStartupMs)),
        lastSevenEvents: numberValue(lastSeven?.total)
      },
      daily: fillDaily(days, dailyRows),
      eventTypes: eventTypeRows.map(row => ({ eventType: row.eventType, total: numberValue(row.total) })),
      versions: versionRows.map(row => ({
        versionId: row.versionId,
        version: row.version || row.channel,
        channel: row.channel,
        environment: row.environment,
        total: numberValue(row.total)
      })),
      platforms: platformRows.map(row => ({ platform: row.platform || '-', arch: row.arch || '-', total: numberValue(row.total) })),
      clients: clientRows.map(row => ({
        clientId: row.clientId,
        clientName: row.clientName || '-',
        clientVersion: row.clientVersion || '-',
        version: row.version?.version || row.currentVersion || '-',
        platform: row.platform || '-',
        arch: row.arch || '-',
        total: numberValue(row.eventCount),
        startups: numberValue(row.startupCount),
        downloads: numberValue(row.downloadCount),
        errors: numberValue(row.errorCount),
        totalBytes: numberValue(row.totalBytes),
        lastSeenAt: row.lastSeenAt,
        lastEventType: row.lastEventType,
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        recentEvents: (eventsByClient.get(row.clientId) || []).map(eventRow => ({
          id: eventRow.id,
          eventType: eventRow.eventType,
          version: eventRow.version?.version || eventRow.currentVersion || '-',
          source: eventRow.source,
          metadata: parseMetadata(eventRow.metadata),
          userAgent: eventRow.userAgent,
          ipAddress: eventRow.ipAddress,
          durationMs: eventRow.durationMs,
          startupDurationMs: eventRow.startupDurationMs,
          bytes: eventRow.bytes,
          createdAt: eventRow.createdAt
        }))
      })),
      recent: recentRows.map(row => ({
        id: row.id,
        eventType: row.eventType,
        versionId: row.fileVersionId,
        version: row.version?.version || row.currentVersion || '-',
        clientId: row.clientId,
        clientName: row.clientName,
        platform: row.platform,
        arch: row.arch,
        durationMs: row.durationMs,
        startupDurationMs: row.startupDurationMs,
        bytes: row.bytes,
        metadata: parseMetadata(row.metadata),
        source: row.source,
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        createdAt: row.createdAt
      }))
    }
  }

  const app = await getAppById(id)
  const where = and(eq(appClientEvents.appId, id), gte(appClientEvents.createdAt, since))
  const [
    [summary],
    [lastSeven],
    dailyRows,
    eventTypeRows,
    versionRows,
    platformRows,
    clientRows,
    recentRows
  ] = await Promise.all([
    db.select({
      totalEvents: count(),
      startupEvents: sql<number>`sum(case when ${appClientEvents.eventType} in ('startup', 'launch', 'start') then 1 else 0 end)`,
      downloadEvents: sql<number>`sum(case when ${appClientEvents.eventType} in ('download', 'file_download', 'update_download') then 1 else 0 end)`,
      errorEvents: sql<number>`sum(case when ${appClientEvents.eventType} in ('error', 'crash', 'exception') then 1 else 0 end)`,
      uniqueClients: sql<number>`count(distinct ${appClientEvents.clientId})`,
      totalBytes: sum(appClientEvents.bytes),
      avgStartupMs: sql<number>`avg(${appClientEvents.startupDurationMs})`
    }).from(appClientEvents).where(where),
    db.select({ total: count() }).from(appClientEvents).where(and(
      eq(appClientEvents.appId, id),
      gte(appClientEvents.createdAt, lastSevenSince)
    )),
    db.select({
      date: sql<string>`date(${appClientEvents.createdAt})`,
      events: count(),
      startups: sql<number>`sum(case when ${appClientEvents.eventType} in ('startup', 'launch', 'start') then 1 else 0 end)`,
      downloads: sql<number>`sum(case when ${appClientEvents.eventType} in ('download', 'file_download', 'update_download') then 1 else 0 end)`
    }).from(appClientEvents).where(where).groupBy(sql`date(${appClientEvents.createdAt})`).orderBy(sql`date(${appClientEvents.createdAt})`),
    db.select({ eventType: appClientEvents.eventType, total: count() })
      .from(appClientEvents).where(where).groupBy(appClientEvents.eventType).orderBy(desc(count())),
    db.select({
      versionId: appClientEvents.appVersionId,
      version: appVersions.version,
      channel: appClientEvents.channel,
      total: count()
    }).from(appClientEvents)
      .leftJoin(appVersions, eq(appClientEvents.appVersionId, appVersions.id))
      .where(where)
      .groupBy(appClientEvents.appVersionId, appVersions.version, appClientEvents.channel)
      .orderBy(desc(count())),
    db.select({ platform: appClientEvents.platform, arch: appClientEvents.arch, total: count() })
      .from(appClientEvents).where(where).groupBy(appClientEvents.platform, appClientEvents.arch).orderBy(desc(count())),
    db.query.appClients.findMany({
      where: eq(appClients.appId, id),
      orderBy: [desc(appClients.lastSeenAt), desc(appClients.eventCount)],
      limit: 10,
      with: { version: true }
    }),
    db.query.appClientEvents.findMany({
      where,
      orderBy: [desc(appClientEvents.createdAt), desc(appClientEvents.id)],
      limit: 20,
      with: { version: true }
    })
  ])
  const clientIds = clientRows.map(row => row.clientId).filter((value): value is string => Boolean(value))
  const clientEventRows = clientIds.length
    ? await db.query.appClientEvents.findMany({
        where: and(
          eq(appClientEvents.appId, id),
          inArray(appClientEvents.clientId, clientIds)
        ),
        orderBy: [desc(appClientEvents.createdAt), desc(appClientEvents.id)],
        limit: 100,
        with: { version: true }
      })
    : []
  const eventsByClient = new Map<string, typeof clientEventRows>()

  for (const eventRow of clientEventRows) {
    if (!eventRow.clientId) {
      continue
    }

    const rows = eventsByClient.get(eventRow.clientId) || []

    if (rows.length < 5) {
      rows.push(eventRow)
      eventsByClient.set(eventRow.clientId, rows)
    }
  }

  return {
    type,
    target: { id: app.id, name: app.name, slug: app.slug },
    rangeDays: days,
    summary: {
      totalEvents: numberValue(summary?.totalEvents),
      startupEvents: numberValue(summary?.startupEvents),
      downloadEvents: numberValue(summary?.downloadEvents),
      errorEvents: numberValue(summary?.errorEvents),
      uniqueClients: numberValue(summary?.uniqueClients),
      totalBytes: numberValue(summary?.totalBytes),
      avgStartupMs: Math.round(numberValue(summary?.avgStartupMs)),
      lastSevenEvents: numberValue(lastSeven?.total)
    },
    daily: fillDaily(days, dailyRows),
    eventTypes: eventTypeRows.map(row => ({ eventType: row.eventType, total: numberValue(row.total) })),
    versions: versionRows.map(row => ({
      versionId: row.versionId,
      version: row.version || row.channel,
      channel: row.channel,
      total: numberValue(row.total)
    })),
    platforms: platformRows.map(row => ({ platform: row.platform || '-', arch: row.arch || '-', total: numberValue(row.total) })),
    clients: clientRows.map(row => ({
      clientId: row.clientId,
      clientName: row.clientName || '-',
      clientVersion: row.clientVersion || '-',
      version: row.version?.version || row.currentVersion || '-',
      platform: row.platform || '-',
      arch: row.arch || '-',
      total: numberValue(row.eventCount),
      startups: numberValue(row.startupCount),
      downloads: numberValue(row.downloadCount),
      errors: numberValue(row.errorCount),
      totalBytes: numberValue(row.totalBytes),
      lastSeenAt: row.lastSeenAt,
      lastEventType: row.lastEventType,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      recentEvents: (eventsByClient.get(row.clientId) || []).map(eventRow => ({
        id: eventRow.id,
        eventType: eventRow.eventType,
        version: eventRow.version?.version || eventRow.currentVersion || '-',
        source: eventRow.source,
        metadata: parseMetadata(eventRow.metadata),
        userAgent: eventRow.userAgent,
        ipAddress: eventRow.ipAddress,
        durationMs: eventRow.durationMs,
        startupDurationMs: eventRow.startupDurationMs,
        bytes: eventRow.bytes,
        createdAt: eventRow.createdAt
      }))
    })),
    recent: recentRows.map(row => ({
      id: row.id,
      eventType: row.eventType,
      versionId: row.appVersionId,
      version: row.version?.version || row.currentVersion || '-',
      clientId: row.clientId,
      clientName: row.clientName,
      platform: row.platform,
      arch: row.arch,
      durationMs: row.durationMs,
      startupDurationMs: row.startupDurationMs,
      bytes: row.bytes,
      metadata: parseMetadata(row.metadata),
      source: row.source,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt
    }))
  }
})
