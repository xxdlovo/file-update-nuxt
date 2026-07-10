import { asc, desc, eq } from 'drizzle-orm'
import { fileReleases, fileVersions } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const projectId = parseIntegerParam(getRouterParam(event, 'projectId'), 'projectId')
  await getFileProjectById(projectId)

  const db = useDb()
  const items = await db.query.fileVersions.findMany({
    where: eq(fileVersions.fileProjectId, projectId),
    orderBy: [desc(fileVersions.versionNormalized), asc(fileVersions.channel), asc(fileVersions.environment)]
  })
  const activeReleases = await db.query.fileReleases.findMany({
    where: eq(fileReleases.fileProjectId, projectId)
  })
  const activeByVersion = new Map<number, Array<{ id: number, channel: string, environment: string, publishedAt: string }>>()

  for (const release of activeReleases) {
    if (!release.active) {
      continue
    }

    const existing = activeByVersion.get(release.fileVersionId) || []
    existing.push({
      id: release.id,
      channel: release.channel,
      environment: release.environment,
      publishedAt: release.publishedAt
    })
    activeByVersion.set(release.fileVersionId, existing)
  }

  return {
    items: items.map(item => ({
      ...item,
      activeReleases: activeByVersion.get(item.id) || []
    })),
    total: items.length
  }
})

