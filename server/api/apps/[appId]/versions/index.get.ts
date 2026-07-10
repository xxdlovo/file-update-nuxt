import { asc, desc, eq } from 'drizzle-orm'
import { appVersions, releases } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const appId = parseIntegerParam(getRouterParam(event, 'appId'), 'appId')
  await getAppById(appId)

  const db = useDb()
  const items = await db.query.appVersions.findMany({
    where: eq(appVersions.appId, appId),
    orderBy: [desc(appVersions.versionNormalized), asc(appVersions.channel)]
  })
  const activeReleases = await db.query.releases.findMany({
    where: eq(releases.appId, appId)
  })
  const activeByVersion = new Map<number, Array<{ id: number, channel: string, platform: string, arch: string, publishedAt: string }>>()

  for (const release of activeReleases) {
    if (!release.active) {
      continue
    }

    const existing = activeByVersion.get(release.versionId) || []
    existing.push({
      id: release.id,
      channel: release.channel,
      platform: release.platform,
      arch: release.arch,
      publishedAt: release.publishedAt
    })
    activeByVersion.set(release.versionId, existing)
  }

  return {
    items: items.map(item => ({
      ...item,
      activeReleases: activeByVersion.get(item.id) || []
    })),
    total: items.length
  }
})
