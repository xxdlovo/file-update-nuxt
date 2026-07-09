import { and, desc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { appUpdateCheckEvents, appVersions, apps, releases, updateFiles } from '../../db/schema'

type PublishTarget = {
  platform: string
  arch: string
}

type ReleaseFile = typeof updateFiles.$inferSelect
type VersionWithApp = Awaited<ReturnType<typeof getAppVersionById>>

export async function publishAppVersion(version: VersionWithApp, requestedTargets?: PublishTarget[]) {
  const db = useDb()
  const files = await db.query.updateFiles.findMany({
    where: eq(updateFiles.versionId, version.id),
    orderBy: [desc(updateFiles.packageType)]
  })
  const targets = normalizePublishTargets(files, requestedTargets)

  if (targets.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Upload at least one update file before publishing'
    })
  }

  const now = new Date().toISOString()

  for (const target of targets) {
    await db.update(releases)
      .set({
        active: false,
        updatedAt: now
      })
      .where(and(
        eq(releases.appId, version.appId),
        eq(releases.channel, version.channel),
        eq(releases.platform, target.platform),
        eq(releases.arch, target.arch),
        eq(releases.active, true)
      ))

    await db.insert(releases).values({
      appId: version.appId,
      versionId: version.id,
      channel: version.channel,
      platform: target.platform,
      arch: target.arch,
      active: true,
      publishedAt: now,
      updatedAt: now
    })
  }

  const [published] = await db.update(appVersions)
    .set({
      status: 'published',
      publishedAt: now,
      updatedAt: now
    })
    .where(eq(appVersions.id, version.id))
    .returning()

  return {
    version: published,
    targets
  }
}

export async function revokeAppVersion(version: VersionWithApp) {
  const db = useDb()
  const now = new Date().toISOString()

  await db.update(releases)
    .set({
      active: false,
      updatedAt: now
    })
    .where(and(
      eq(releases.versionId, version.id),
      eq(releases.active, true)
    ))

  const [revoked] = await db.update(appVersions)
    .set({
      status: 'revoked',
      publishedAt: null,
      updatedAt: now
    })
    .where(eq(appVersions.id, version.id))
    .returning()

  return revoked
}

export async function getActiveAppRelease(input: {
  appId?: number
  appSlug?: string
  channel: string
  platform: string
  arch: string
}) {
  const db = useDb()
  let appId = input.appId

  if (!appId && input.appSlug) {
    const app = await getEnabledAppBySlug(input.appSlug)

    if (!app) {
      return null
    }

    appId = app.id
  }

  if (!appId) {
    return null
  }

  return db.query.releases.findFirst({
    where: and(
      eq(releases.appId, appId),
      eq(releases.channel, input.channel),
      eq(releases.platform, input.platform),
      eq(releases.arch, input.arch),
      eq(releases.active, true)
    ),
    with: {
      app: true,
      version: true
    }
  }).then(async (release) => {
    if (!release || !release.app.enabled) {
      return null
    }

    if (input.appSlug && release.app.slug !== input.appSlug) {
      return null
    }

    const files = await db.query.updateFiles.findMany({
      where: and(
        eq(updateFiles.versionId, release.versionId),
        eq(updateFiles.platform, input.platform),
        eq(updateFiles.arch, input.arch)
      )
    })

    return {
      ...release,
      files
    }
  })
}

export async function getEnabledAppBySlug(slug: string) {
  const db = useDb()

  return db.query.apps.findFirst({
    where: and(
      eq(apps.slug, slug),
      eq(apps.enabled, true)
    )
  })
}

function normalizePublishTargets(files: ReleaseFile[], requestedTargets?: PublishTarget[]) {
  const allTargets = uniqueTargets(files)

  if (!requestedTargets?.length) {
    return allTargets
  }

  const available = new Set(allTargets.map(targetKey))
  const selected = requestedTargets.filter(target => available.has(targetKey(target)))

  if (selected.length !== requestedTargets.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'One or more publish targets have no uploaded files'
    })
  }

  return selected
}

function uniqueTargets(files: ReleaseFile[]) {
  const seen = new Set<string>()
  const targets: PublishTarget[] = []

  for (const file of files) {
    const target = {
      platform: file.platform,
      arch: file.arch
    }
    const key = targetKey(target)

    if (!seen.has(key)) {
      seen.add(key)
      targets.push(target)
    }
  }

  return targets
}

function targetKey(target: PublishTarget) {
  return `${target.platform}:${target.arch}`
}

export async function recordAppUpdateCheck(input: {
  appId: number
  versionId?: number | null
  channel: string
  platform: string
  arch: string
  currentVersion?: string
  updateAvailable: boolean
  filesIssued?: number
  event: H3Event
  source?: 'api' | 'electron-updater'
}) {
  const db = useDb()
  const request = requestAnalytics(input.event)

  await db.insert(appUpdateCheckEvents).values({
    appId: input.appId,
    appVersionId: input.versionId || null,
    channel: input.channel,
    platform: input.platform,
    arch: input.arch,
    currentVersion: input.currentVersion || null,
    updateAvailable: input.updateAvailable,
    filesIssued: input.filesIssued || 0,
    source: input.source || 'api',
    userAgent: request.userAgent,
    referer: request.referer,
    ipHash: request.ipHash,
    createdAt: new Date().toISOString()
  })
}
