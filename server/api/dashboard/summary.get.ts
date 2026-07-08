import { count, desc, eq } from 'drizzle-orm'
import { appVersions, apps, fileProjects, fileReleases, fileVersions, releases, updateFiles } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const db = useDb()
  const [
    [appsRow],
    [fileProjectsRow],
    [publishedAppVersionsRow],
    [publishedFileVersionsRow],
    [activeReleasesRow],
    [uploadedFilesRow],
    recentElectronReleases,
    recentUpdateFiles,
    recentFileReleases
  ] = await Promise.all([
    db.select({ total: count() }).from(apps),
    db.select({ total: count() }).from(fileProjects),
    db.select({ total: count() }).from(appVersions).where(eq(appVersions.status, 'published')),
    db.select({ total: count() }).from(fileVersions).where(eq(fileVersions.status, 'published')),
    db.select({ total: count() }).from(releases).where(eq(releases.active, true)),
    db.select({ total: count() }).from(updateFiles),
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
    })
  ])

  return {
    stats: {
      apps: appsRow?.total || 0,
      fileProjects: fileProjectsRow?.total || 0,
      publishedElectronVersions: publishedAppVersionsRow?.total || 0,
      publishedFileVersions: publishedFileVersionsRow?.total || 0,
      activeReleases: activeReleasesRow?.total || 0,
      uploadedFiles: uploadedFilesRow?.total || 0
    },
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
      }))
  }
})
