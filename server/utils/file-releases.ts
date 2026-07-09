import { and, eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { fileDownloadEvents, fileProjects, fileReleases, fileUpdateCheckEvents, fileVersions } from '../../db/schema'

type FileVersionWithProject = Awaited<ReturnType<typeof getFileVersionById>>

export async function publishFileVersion(version: FileVersionWithProject) {
  if (!version.fileName || !version.objectKey || version.size <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Upload a file before publishing'
    })
  }

  const db = useDb()
  const now = new Date().toISOString()

  await db.update(fileReleases)
    .set({
      active: false,
      updatedAt: now
    })
    .where(and(
      eq(fileReleases.fileProjectId, version.fileProjectId),
      eq(fileReleases.channel, version.channel),
      eq(fileReleases.environment, version.environment),
      eq(fileReleases.active, true)
    ))

  await db.insert(fileReleases).values({
    fileProjectId: version.fileProjectId,
    fileVersionId: version.id,
    channel: version.channel,
    environment: version.environment,
    active: true,
    publishedAt: now,
    updatedAt: now
  })

  const [published] = await db.update(fileVersions)
    .set({
      status: 'published',
      publishedAt: now,
      updatedAt: now
    })
    .where(eq(fileVersions.id, version.id))
    .returning()

  return published
}

export async function revokeFileVersion(version: FileVersionWithProject) {
  const db = useDb()
  const now = new Date().toISOString()

  await db.update(fileReleases)
    .set({
      active: false,
      updatedAt: now
    })
    .where(and(
      eq(fileReleases.fileVersionId, version.id),
      eq(fileReleases.active, true)
    ))

  const [revoked] = await db.update(fileVersions)
    .set({
      status: 'revoked',
      publishedAt: null,
      updatedAt: now
    })
    .where(eq(fileVersions.id, version.id))
    .returning()

  return revoked
}

export async function getEnabledFileProjectBySlug(slug: string) {
  const db = useDb()

  return db.query.fileProjects.findFirst({
    where: and(
      eq(fileProjects.slug, slug),
      eq(fileProjects.enabled, true)
    )
  })
}

export async function getActiveFileRelease(input: {
  fileProjectId?: number
  fileSlug?: string
  channel: string
  environment: string
}) {
  const db = useDb()
  let fileProjectId = input.fileProjectId

  if (!fileProjectId && input.fileSlug) {
    const project = await getEnabledFileProjectBySlug(input.fileSlug)

    if (!project) {
      return null
    }

    fileProjectId = project.id
  }

  if (!fileProjectId) {
    return null
  }

  const release = await db.query.fileReleases.findFirst({
    where: and(
      eq(fileReleases.fileProjectId, fileProjectId),
      eq(fileReleases.channel, input.channel),
      eq(fileReleases.environment, input.environment),
      eq(fileReleases.active, true)
    ),
    with: {
      project: true,
      version: true
    }
  })

  if (!release || !release.project.enabled) {
    return null
  }

  if (input.fileSlug && release.project.slug !== input.fileSlug) {
    return null
  }

  return release
}

export function serializePublicFileVersion(version: typeof fileVersions.$inferSelect, downloadUrl: string) {
  return {
    id: version.id,
    version: version.version,
    channel: version.channel,
    environment: version.environment,
    releaseNotes: version.releaseNotes,
    fileName: version.fileName,
    size: version.size,
    sha256: version.sha256,
    mimeType: version.mimeType,
    visibility: version.visibility,
    publishedAt: version.publishedAt,
    downloadUrl
  }
}

export async function recordFileVersionDownload(input: {
  version: typeof fileVersions.$inferSelect
  event: H3Event
  source?: 'api' | 'share'
  tokenProvided?: boolean
}) {
  const db = useDb()
  const now = new Date().toISOString()
  const request = requestAnalytics(input.event)

  await db.update(fileVersions)
    .set({
      downloadCount: sql`${fileVersions.downloadCount} + 1`,
      updatedAt: now
    })
    .where(eq(fileVersions.id, input.version.id))

  await db.insert(fileDownloadEvents).values({
    fileProjectId: input.version.fileProjectId,
    fileVersionId: input.version.id,
    channel: input.version.channel,
    environment: input.version.environment,
    source: input.source || 'api',
    fileName: input.version.fileName,
    userAgent: request.userAgent,
    referer: request.referer,
    ipHash: request.ipHash,
    tokenProvided: Boolean(input.tokenProvided),
    createdAt: now
  })
}

export async function recordFileUpdateCheck(input: {
  projectId: number
  versionId?: number | null
  channel: string
  environment: string
  currentVersion?: string
  updateAvailable: boolean
  event: H3Event
  source?: 'api'
  tokenProvided?: boolean
}) {
  const db = useDb()
  const request = requestAnalytics(input.event)

  await db.insert(fileUpdateCheckEvents).values({
    fileProjectId: input.projectId,
    fileVersionId: input.versionId || null,
    channel: input.channel,
    environment: input.environment,
    currentVersion: input.currentVersion || null,
    updateAvailable: input.updateAvailable,
    source: input.source || 'api',
    userAgent: request.userAgent,
    referer: request.referer,
    ipHash: request.ipHash,
    tokenProvided: Boolean(input.tokenProvided),
    createdAt: new Date().toISOString()
  })
}
