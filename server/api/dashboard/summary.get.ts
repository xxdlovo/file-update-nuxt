import { count, desc, eq, gte, sql } from 'drizzle-orm'
import {
  appClientEvents,
  appClients,
  appUpdateCheckEvents,
  appVersions,
  apps,
  fileClientEvents,
  fileClients,
  fileDownloadEvents,
  fileProjects,
  fileReleases,
  fileUpdateCheckEvents,
  fileVersions,
  releases,
  updateFiles
} from '../../../db/schema'

function startDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - Math.max(days - 1, 0))
  date.setHours(0, 0, 0, 0)

  return date.toISOString()
}

function fillDailyActivity(days: number, rows: Array<{ date: string, checks?: number, downloads?: number, clientEvents?: number }>) {
  const byDate = new Map<string, { checks: number, downloads: number, clientEvents: number }>()

  for (const row of rows) {
    const existing = byDate.get(row.date) || { checks: 0, downloads: 0, clientEvents: 0 }
    existing.checks += Number(row.checks || 0)
    existing.downloads += Number(row.downloads || 0)
    existing.clientEvents += Number(row.clientEvents || 0)
    byDate.set(row.date, existing)
  }

  return Array.from({ length: days }, (_, offset) => {
    const date = new Date()
    date.setDate(date.getDate() - (days - 1 - offset))
    const key = date.toISOString().slice(0, 10)
    const row = byDate.get(key) || { checks: 0, downloads: 0, clientEvents: 0 }

    return {
      date: key,
      ...row
    }
  })
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const db = useDb()
  const lastSevenSince = startDate(7)
  const chartSince = startDate(14)
  const [
    [appsRow],
    [fileProjectsRow],
    [publishedAppVersionsRow],
    [publishedFileVersionsRow],
    [activeAppReleasesRow],
    [activeFileReleasesRow],
    [uploadedFilesRow],
    [appChecksRow],
    [fileChecksRow],
    [fileDownloadsRow],
    [appClientEventsRow],
    [fileClientEventsRow],
    [uniqueAppClientsRow],
    [uniqueFileClientsRow],
    appCheckDailyRows,
    fileCheckDailyRows,
    fileDownloadDailyRows,
    appClientDailyRows,
    fileClientDailyRows,
    recentElectronReleases,
    recentUpdateFiles,
    recentFileReleases,
    recentAppClients,
    recentFileClients
  ] = await Promise.all([
    db.select({ total: count() }).from(apps),
    db.select({ total: count() }).from(fileProjects),
    db.select({ total: count() }).from(appVersions).where(eq(appVersions.status, 'published')),
    db.select({ total: count() }).from(fileVersions).where(eq(fileVersions.status, 'published')),
    db.select({ total: count() }).from(releases).where(eq(releases.active, true)),
    db.select({ total: count() }).from(fileReleases).where(eq(fileReleases.active, true)),
    db.select({ total: count() }).from(updateFiles),
    db.select({ total: count() }).from(appUpdateCheckEvents).where(gte(appUpdateCheckEvents.createdAt, lastSevenSince)),
    db.select({ total: count() }).from(fileUpdateCheckEvents).where(gte(fileUpdateCheckEvents.createdAt, lastSevenSince)),
    db.select({ total: count() }).from(fileDownloadEvents).where(gte(fileDownloadEvents.createdAt, lastSevenSince)),
    db.select({ total: count() }).from(appClientEvents).where(gte(appClientEvents.createdAt, lastSevenSince)),
    db.select({ total: count() }).from(fileClientEvents).where(gte(fileClientEvents.createdAt, lastSevenSince)),
    db.select({ total: count() }).from(appClients),
    db.select({ total: count() }).from(fileClients),
    db.select({ date: sql<string>`date(${appUpdateCheckEvents.createdAt})`, checks: count() })
      .from(appUpdateCheckEvents)
      .where(gte(appUpdateCheckEvents.createdAt, chartSince))
      .groupBy(sql`date(${appUpdateCheckEvents.createdAt})`),
    db.select({ date: sql<string>`date(${fileUpdateCheckEvents.createdAt})`, checks: count() })
      .from(fileUpdateCheckEvents)
      .where(gte(fileUpdateCheckEvents.createdAt, chartSince))
      .groupBy(sql`date(${fileUpdateCheckEvents.createdAt})`),
    db.select({ date: sql<string>`date(${fileDownloadEvents.createdAt})`, downloads: count() })
      .from(fileDownloadEvents)
      .where(gte(fileDownloadEvents.createdAt, chartSince))
      .groupBy(sql`date(${fileDownloadEvents.createdAt})`),
    db.select({ date: sql<string>`date(${appClientEvents.createdAt})`, clientEvents: count() })
      .from(appClientEvents)
      .where(gte(appClientEvents.createdAt, chartSince))
      .groupBy(sql`date(${appClientEvents.createdAt})`),
    db.select({ date: sql<string>`date(${fileClientEvents.createdAt})`, clientEvents: count() })
      .from(fileClientEvents)
      .where(gte(fileClientEvents.createdAt, chartSince))
      .groupBy(sql`date(${fileClientEvents.createdAt})`),
    db.query.releases.findMany({
      where: eq(releases.active, true),
      orderBy: [desc(releases.publishedAt), desc(releases.id)],
      limit: 6,
      with: {
        app: true,
        version: true
      }
    }),
    db.query.updateFiles.findMany({
      orderBy: [desc(updateFiles.createdAt), desc(updateFiles.id)],
      limit: 6,
      with: {
        app: true,
        version: true
      }
    }),
    db.query.fileReleases.findMany({
      where: eq(fileReleases.active, true),
      orderBy: [desc(fileReleases.publishedAt), desc(fileReleases.id)],
      limit: 6,
      with: {
        project: true,
        version: true
      }
    }),
    db.query.appClients.findMany({
      orderBy: [desc(appClients.lastSeenAt), desc(appClients.eventCount)],
      limit: 6,
      with: {
        app: true,
        version: true
      }
    }),
    db.query.fileClients.findMany({
      orderBy: [desc(fileClients.lastSeenAt), desc(fileClients.eventCount)],
      limit: 6,
      with: {
        project: true,
        version: true
      }
    })
  ])

  return {
    stats: {
      apps: appsRow?.total || 0,
      fileProjects: fileProjectsRow?.total || 0,
      publishedElectronVersions: publishedAppVersionsRow?.total || 0,
      publishedFileVersions: publishedFileVersionsRow?.total || 0,
      activeElectronReleases: activeAppReleasesRow?.total || 0,
      activeFileReleases: activeFileReleasesRow?.total || 0,
      activeReleases: (activeAppReleasesRow?.total || 0) + (activeFileReleasesRow?.total || 0),
      uploadedFiles: uploadedFilesRow?.total || 0,
      lastSevenAppChecks: appChecksRow?.total || 0,
      lastSevenFileChecks: fileChecksRow?.total || 0,
      lastSevenFileDownloads: fileDownloadsRow?.total || 0,
      lastSevenClientEvents: (appClientEventsRow?.total || 0) + (fileClientEventsRow?.total || 0),
      uniqueClients: Number(uniqueAppClientsRow?.total || 0) + Number(uniqueFileClientsRow?.total || 0)
    },
    dailyActivity: fillDailyActivity(14, [
      ...appCheckDailyRows,
      ...fileCheckDailyRows,
      ...fileDownloadDailyRows,
      ...appClientDailyRows,
      ...fileClientDailyRows
    ]),
    recentElectronReleases: recentElectronReleases
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id)
      .map(release => ({
        id: release.id,
        appId: release.appId,
        appName: release.app.name,
        appSlug: release.app.slug,
        versionId: release.versionId,
        version: release.version.version,
        channel: release.channel,
        platform: release.platform,
        arch: release.arch,
        publishedAt: release.publishedAt
      })),
    recentUpdateFiles: recentUpdateFiles
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
      .map(file => ({
        id: file.id,
        appId: file.appId,
        appName: file.app.name,
        versionId: file.versionId,
        version: file.version.version,
        platform: file.platform,
        arch: file.arch,
        packageType: file.packageType,
        fileName: file.fileName,
        size: file.size,
        createdAt: file.createdAt
      })),
    recentFileReleases: recentFileReleases
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id)
      .map(release => ({
        id: release.id,
        fileProjectId: release.fileProjectId,
        projectName: release.project.name,
        projectSlug: release.project.slug,
        fileVersionId: release.fileVersionId,
        version: release.version.version,
        channel: release.channel,
        environment: release.environment,
        visibility: release.version.visibility,
        publishedAt: release.publishedAt
      })),
    recentClients: [
      ...recentAppClients.map(client => ({
        id: client.id,
        type: 'app' as const,
        targetId: client.appId,
        targetName: client.app.name,
        targetSlug: client.app.slug,
        version: client.version?.version || client.currentVersion || '-',
        clientId: client.clientId,
        clientName: client.clientName || '-',
        platform: client.platform || '-',
        arch: client.arch || '-',
        eventCount: client.eventCount,
        startupCount: client.startupCount,
        downloadCount: client.downloadCount,
        errorCount: client.errorCount,
        lastSeenAt: client.lastSeenAt
      })),
      ...recentFileClients.map(client => ({
        id: client.id,
        type: 'file' as const,
        targetId: client.fileProjectId,
        targetName: client.project.name,
        targetSlug: client.project.slug,
        version: client.version?.version || client.currentVersion || '-',
        clientId: client.clientId,
        clientName: client.clientName || '-',
        platform: client.platform || '-',
        arch: client.arch || '-',
        eventCount: client.eventCount,
        startupCount: client.startupCount,
        downloadCount: client.downloadCount,
        errorCount: client.errorCount,
        lastSeenAt: client.lastSeenAt
      }))
    ].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)).slice(0, 6)
  }
})
