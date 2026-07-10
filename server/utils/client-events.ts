import { and, eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { appClientEvents, appClients, appVersions, fileClientEvents, fileClients, fileVersions } from '../../db/schema'

type ClientEventBody = {
  eventType?: string
  clientId?: string
  clientName?: string
  clientVersion?: string
  platform?: string
  arch?: string
  channel?: string
  environment?: string
  version?: string
  currentVersion?: string
  versionId?: number
  startupDurationMs?: number
  durationMs?: number
  bytes?: number
  metadata?: unknown
  source?: string
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function optionalPositiveInteger(value: unknown) {
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null
}

function metadataText(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }

  return JSON.stringify(value)
}

function eventType(value: unknown) {
  const type = optionalString(value)

  if (!type) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Event type is required'
    })
  }

  return type
}

function isStartupEvent(type: string) {
  return ['startup', 'launch', 'start'].includes(type)
}

function isDownloadEvent(type: string) {
  return ['download', 'file_download', 'update_download'].includes(type)
}

function isErrorEvent(type: string) {
  return ['error', 'crash', 'exception'].includes(type)
}

async function resolveAppVersionId(appId: number, body: ClientEventBody, channel: string) {
  const db = useDb()
  const versionId = Number(body.versionId)

  if (Number.isInteger(versionId) && versionId > 0) {
    const version = await db.query.appVersions.findFirst({
      where: and(
        eq(appVersions.id, versionId),
        eq(appVersions.appId, appId)
      )
    })

    return version?.id || null
  }

  const version = optionalString(body.version) || optionalString(body.currentVersion)

  if (!version) {
    return null
  }

  const matched = await db.query.appVersions.findFirst({
    where: and(
      eq(appVersions.appId, appId),
      eq(appVersions.channel, channel),
      eq(appVersions.version, version)
    )
  })

  return matched?.id || null
}

async function resolveFileVersionId(fileProjectId: number, body: ClientEventBody, channel: string, environment: string) {
  const db = useDb()
  const versionId = Number(body.versionId)

  if (Number.isInteger(versionId) && versionId > 0) {
    const version = await db.query.fileVersions.findFirst({
      where: and(
        eq(fileVersions.id, versionId),
        eq(fileVersions.fileProjectId, fileProjectId)
      )
    })

    return version?.id || null
  }

  const version = optionalString(body.version) || optionalString(body.currentVersion)

  if (!version) {
    return null
  }

  const matched = await db.query.fileVersions.findFirst({
    where: and(
      eq(fileVersions.fileProjectId, fileProjectId),
      eq(fileVersions.channel, channel),
      eq(fileVersions.environment, environment),
      eq(fileVersions.version, version)
    )
  })

  return matched?.id || null
}

export async function recordAppClientEvent(event: H3Event, app: { id: number, defaultChannel: string }, body: ClientEventBody) {
  const db = useDb()
  const request = requestAnalytics(event)
  const channel = optionalString(body.channel) || app.defaultChannel
  const appVersionId = await resolveAppVersionId(app.id, body, channel)
  const type = eventType(body.eventType)
  const clientId = optionalString(body.clientId)
  const startupDurationMs = optionalPositiveInteger(body.startupDurationMs)
  const bytes = optionalPositiveInteger(body.bytes)
  const now = new Date().toISOString()
  const [created] = await db.insert(appClientEvents).values({
    appId: app.id,
    appVersionId,
    eventType: type,
    clientId,
    clientName: optionalString(body.clientName),
    clientVersion: optionalString(body.clientVersion),
    platform: optionalString(body.platform),
    arch: optionalString(body.arch),
    channel,
    currentVersion: optionalString(body.currentVersion) || optionalString(body.version),
    startupDurationMs,
    durationMs: optionalPositiveInteger(body.durationMs),
    bytes,
    metadata: metadataText(body.metadata),
    source: optionalString(body.source) || 'client',
    userAgent: request.userAgent,
    referer: request.referer,
    ipHash: request.ipHash,
    ipAddress: request.ipAddress,
    createdAt: now
  }).returning()

  if (clientId) {
    await db.insert(appClients).values({
      appId: app.id,
      appVersionId,
      clientId,
      clientName: optionalString(body.clientName),
      clientVersion: optionalString(body.clientVersion),
      platform: optionalString(body.platform),
      arch: optionalString(body.arch),
      channel,
      currentVersion: optionalString(body.currentVersion) || optionalString(body.version),
      lastEventType: type,
      eventCount: 1,
      startupCount: isStartupEvent(type) ? 1 : 0,
      downloadCount: isDownloadEvent(type) ? 1 : 0,
      errorCount: isErrorEvent(type) ? 1 : 0,
      totalBytes: bytes || 0,
      totalStartupDurationMs: isStartupEvent(type) ? startupDurationMs || 0 : 0,
      firstSeenAt: now,
      lastSeenAt: now,
      userAgent: request.userAgent,
      ipHash: request.ipHash,
      ipAddress: request.ipAddress,
      updatedAt: now
    }).onConflictDoUpdate({
      target: [appClients.appId, appClients.clientId],
      set: {
        appVersionId,
        clientName: optionalString(body.clientName),
        clientVersion: optionalString(body.clientVersion),
        platform: optionalString(body.platform),
        arch: optionalString(body.arch),
        channel,
        currentVersion: optionalString(body.currentVersion) || optionalString(body.version),
        lastEventType: type,
        eventCount: sql`${appClients.eventCount} + 1`,
        startupCount: isStartupEvent(type) ? sql`${appClients.startupCount} + 1` : sql`${appClients.startupCount}`,
        downloadCount: isDownloadEvent(type) ? sql`${appClients.downloadCount} + 1` : sql`${appClients.downloadCount}`,
        errorCount: isErrorEvent(type) ? sql`${appClients.errorCount} + 1` : sql`${appClients.errorCount}`,
        totalBytes: sql`${appClients.totalBytes} + ${bytes || 0}`,
        totalStartupDurationMs: sql`${appClients.totalStartupDurationMs} + ${isStartupEvent(type) ? startupDurationMs || 0 : 0}`,
        lastSeenAt: now,
        userAgent: request.userAgent,
        ipHash: request.ipHash,
        ipAddress: request.ipAddress,
        updatedAt: now
      }
    })
  }

  return created
}

export async function recordFileClientEvent(
  event: H3Event,
  project: { id: number, defaultChannel: string },
  body: ClientEventBody
) {
  const db = useDb()
  const request = requestAnalytics(event)
  const channel = optionalString(body.channel) || project.defaultChannel
  const environment = optionalString(body.environment) || 'prod'
  const fileVersionId = await resolveFileVersionId(project.id, body, channel, environment)
  const type = eventType(body.eventType)
  const clientId = optionalString(body.clientId)
  const startupDurationMs = optionalPositiveInteger(body.startupDurationMs)
  const bytes = optionalPositiveInteger(body.bytes)
  const now = new Date().toISOString()
  const [created] = await db.insert(fileClientEvents).values({
    fileProjectId: project.id,
    fileVersionId,
    eventType: type,
    clientId,
    clientName: optionalString(body.clientName),
    clientVersion: optionalString(body.clientVersion),
    platform: optionalString(body.platform),
    arch: optionalString(body.arch),
    channel,
    environment,
    currentVersion: optionalString(body.currentVersion) || optionalString(body.version),
    startupDurationMs,
    durationMs: optionalPositiveInteger(body.durationMs),
    bytes,
    metadata: metadataText(body.metadata),
    source: optionalString(body.source) || 'client',
    userAgent: request.userAgent,
    referer: request.referer,
    ipHash: request.ipHash,
    ipAddress: request.ipAddress,
    createdAt: now
  }).returning()

  if (clientId) {
    await db.insert(fileClients).values({
      fileProjectId: project.id,
      fileVersionId,
      clientId,
      clientName: optionalString(body.clientName),
      clientVersion: optionalString(body.clientVersion),
      platform: optionalString(body.platform),
      arch: optionalString(body.arch),
      channel,
      environment,
      currentVersion: optionalString(body.currentVersion) || optionalString(body.version),
      lastEventType: type,
      eventCount: 1,
      startupCount: isStartupEvent(type) ? 1 : 0,
      downloadCount: isDownloadEvent(type) ? 1 : 0,
      errorCount: isErrorEvent(type) ? 1 : 0,
      totalBytes: bytes || 0,
      totalStartupDurationMs: isStartupEvent(type) ? startupDurationMs || 0 : 0,
      firstSeenAt: now,
      lastSeenAt: now,
      userAgent: request.userAgent,
      ipHash: request.ipHash,
      ipAddress: request.ipAddress,
      updatedAt: now
    }).onConflictDoUpdate({
      target: [fileClients.fileProjectId, fileClients.clientId],
      set: {
        fileVersionId,
        clientName: optionalString(body.clientName),
        clientVersion: optionalString(body.clientVersion),
        platform: optionalString(body.platform),
        arch: optionalString(body.arch),
        channel,
        environment,
        currentVersion: optionalString(body.currentVersion) || optionalString(body.version),
        lastEventType: type,
        eventCount: sql`${fileClients.eventCount} + 1`,
        startupCount: isStartupEvent(type) ? sql`${fileClients.startupCount} + 1` : sql`${fileClients.startupCount}`,
        downloadCount: isDownloadEvent(type) ? sql`${fileClients.downloadCount} + 1` : sql`${fileClients.downloadCount}`,
        errorCount: isErrorEvent(type) ? sql`${fileClients.errorCount} + 1` : sql`${fileClients.errorCount}`,
        totalBytes: sql`${fileClients.totalBytes} + ${bytes || 0}`,
        totalStartupDurationMs: sql`${fileClients.totalStartupDurationMs} + ${isStartupEvent(type) ? startupDurationMs || 0 : 0}`,
        lastSeenAt: now,
        userAgent: request.userAgent,
        ipHash: request.ipHash,
        ipAddress: request.ipAddress,
        updatedAt: now
      }
    })
  }

  return created
}
