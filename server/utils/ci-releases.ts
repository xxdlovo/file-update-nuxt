import { and, eq } from 'drizzle-orm'
import { appVersions, apps, fileProjects, fileVersions, updateFiles } from '../../db/schema'

type CiElectronFileInput = {
  platform?: string
  arch?: string
  packageType?: string
  fileName?: string
  contentType?: string
}

type CiElectronCompleteFileInput = CiElectronFileInput & {
  objectKey?: string
  bucket?: string
  endpoint?: string | null
  size?: number
  sha256?: string
  sha512?: string
  mimeType?: string
  storageConfigId?: number | null
}

type CiFileCompleteInput = {
  fileName?: string
  objectKey?: string
  bucket?: string
  endpoint?: string | null
  size?: number
  sha256?: string
  mimeType?: string
  storageConfigId?: number | null
}

async function getCiAppBySlug(slug: string) {
  const db = useDb()
  const app = await db.query.apps.findFirst({
    where: and(
      eq(apps.slug, slug),
      eq(apps.enabled, true)
    )
  })

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Application not found'
    })
  }

  return app
}

async function getCiFileProjectBySlug(slug: string) {
  const db = useDb()
  const project = await db.query.fileProjects.findFirst({
    where: and(
      eq(fileProjects.slug, slug),
      eq(fileProjects.enabled, true)
    )
  })

  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File project not found'
    })
  }

  return project
}

function assertVersion(value?: string) {
  const version = value?.trim()

  if (!version) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Version is required'
    })
  }

  return version
}

function assertFileName(value?: string) {
  const fileName = value?.trim()

  if (!fileName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File name is required'
    })
  }

  return fileName
}

function serializeUploadRequest(input: {
  objectKey: string
  storageConfigId?: number | null
  bucket: string
  endpoint?: string | null
  uploadRequest: ReturnType<typeof createSignedUploadRequest>
}) {
  return {
    method: input.uploadRequest.method,
    uploadUrl: input.uploadRequest.uploadUrl,
    objectKey: input.objectKey,
    storageConfigId: input.storageConfigId || null,
    bucket: input.bucket,
    endpoint: input.endpoint || null,
    headers: input.uploadRequest.headers,
    fields: input.uploadRequest.fields
  }
}

export async function prepareCiElectronRelease(event: Parameters<typeof writeAuditLog>[0], appSlug: string, body: {
  version?: string
  buildNumber?: string
  channel?: string
  forceUpdate?: boolean
  releaseNotes?: string
  storageConfigId?: number
  files?: CiElectronFileInput[]
}) {
  await requireCiApiToken(event)

  const app = await getCiAppBySlug(appSlug)
  const version = assertVersion(body.version)
  const channel = body.channel?.trim() || app.defaultChannel
  const files = body.files || []

  if (files.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one file is required'
    })
  }

  const db = useDb()
  const versionNormalized = normalizeVersion(version)
  const now = new Date().toISOString()
  let appVersion = await db.query.appVersions.findFirst({
    where: and(
      eq(appVersions.appId, app.id),
      eq(appVersions.channel, channel),
      eq(appVersions.version, version)
    )
  })

  if (appVersion) {
    const [updated] = await db.update(appVersions)
      .set({
        versionNormalized,
        buildNumber: body.buildNumber?.trim() || null,
        forceUpdate: body.forceUpdate ?? appVersion.forceUpdate,
        releaseNotes: body.releaseNotes?.trim() || appVersion.releaseNotes,
        updatedAt: now
      })
      .where(eq(appVersions.id, appVersion.id))
      .returning()
    appVersion = updated
  } else {
    const [created] = await db.insert(appVersions).values({
      appId: app.id,
      version,
      versionNormalized,
      buildNumber: body.buildNumber?.trim() || null,
      channel,
      status: 'draft',
      forceUpdate: body.forceUpdate ?? false,
      releaseNotes: body.releaseNotes?.trim() || null,
      updatedAt: now
    }).returning()
    appVersion = created
  }

  const oss = await resolveUploadStorageConfig(body.storageConfigId ? Number(body.storageConfigId) : undefined)
  const uploadTasks = files.map((file) => {
    assertUploadTarget(file)
    const fileName = assertFileName(file.fileName)
    const contentType = file.contentType || 'application/octet-stream'
    const objectKey = createUpdateObjectKey({
      appSlug: app.slug,
      version,
      platform: file.platform!,
      arch: file.arch!,
      packageType: file.packageType!,
      fileName
    }, oss)
    const uploadRequest = createSignedUploadRequest(objectKey, contentType, oss)

    return {
      platform: file.platform!,
      arch: file.arch!,
      packageType: file.packageType!,
      fileName,
      contentType,
      upload: serializeUploadRequest({
        objectKey,
        storageConfigId: oss.id || null,
        bucket: oss.bucket,
        endpoint: oss.endpoint,
        uploadRequest
      })
    }
  })

  await writeAuditLog(event, {
    action: 'ci.app_release.prepare',
    resourceType: 'app_version',
    resourceId: appVersion.id,
    metadata: {
      appId: app.id,
      version,
      channel,
      files: uploadTasks.length
    }
  })

  return {
    app,
    version: appVersion,
    uploadTasks
  }
}

export async function completeCiElectronRelease(event: Parameters<typeof writeAuditLog>[0], appSlug: string, body: {
  versionId?: number
  version?: string
  channel?: string
  publish?: boolean
  targets?: Array<{ platform?: string, arch?: string }>
  files?: CiElectronCompleteFileInput[]
}) {
  await requireCiApiToken(event)

  const app = await getCiAppBySlug(appSlug)
  const db = useDb()
  const appVersion = body.versionId
    ? await getAppVersionById(Number(body.versionId))
    : await db.query.appVersions.findFirst({
        where: and(
          eq(appVersions.appId, app.id),
          eq(appVersions.channel, body.channel?.trim() || app.defaultChannel),
          eq(appVersions.version, assertVersion(body.version))
        )
      })

  if (!appVersion || appVersion.appId !== app.id) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Version not found'
    })
  }

  const files = body.files || []

  if (files.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one completed file is required'
    })
  }

  const completed = []

  for (const file of files) {
    assertUploadTarget(file)

    if (!file.objectKey || !file.size) {
      throw createError({
        statusCode: 400,
        statusMessage: 'File object information is required'
      })
    }

    const fileName = assertFileName(file.fileName)
    const oss = file.storageConfigId
      ? await getStorageConfigById(Number(file.storageConfigId))
      : requireOssConfig()
    const [created] = await db.insert(updateFiles).values({
      appId: app.id,
      versionId: appVersion.id,
      storageConfigId: file.storageConfigId ? Number(file.storageConfigId) : null,
      platform: file.platform!,
      arch: file.arch!,
      packageType: file.packageType!,
      fileName,
      objectKey: file.objectKey,
      bucket: file.bucket || oss.bucket,
      endpoint: file.endpoint || oss.endpoint || null,
      size: Number(file.size),
      sha256: file.sha256 || null,
      sha512: file.sha512 || null,
      mimeType: file.mimeType || null
    }).returning()

    completed.push(created)
  }

  const publishResult = body.publish
    ? await publishAppVersion(appVersion, body.targets?.map((target) => {
        if (!target.platform || !target.arch) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invalid publish target'
          })
        }

        return {
          platform: target.platform,
          arch: target.arch
        }
      }))
    : null

  await writeAuditLog(event, {
    action: body.publish ? 'ci.app_release.complete_publish' : 'ci.app_release.complete',
    resourceType: 'app_version',
    resourceId: appVersion.id,
    metadata: {
      appId: app.id,
      version: appVersion.version,
      channel: appVersion.channel,
      files: completed.length,
      published: Boolean(body.publish)
    }
  })

  return {
    app,
    version: appVersion,
    files: completed,
    published: publishResult
  }
}

export async function prepareCiFileRelease(event: Parameters<typeof writeAuditLog>[0], fileSlug: string, body: {
  version?: string
  channel?: string
  environment?: string
  releaseNotes?: string
  visibility?: string
  fileName?: string
  contentType?: string
  storageConfigId?: number
}) {
  await requireCiApiToken(event)

  const project = await getCiFileProjectBySlug(fileSlug)
  const version = assertVersion(body.version)
  const channel = body.channel?.trim() || project.defaultChannel
  const environment = body.environment?.trim() || 'prod'
  const visibility = body.visibility?.trim() || 'signed'
  const fileName = assertFileName(body.fileName)

  if (!['signed', 'public'].includes(visibility)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid visibility'
    })
  }

  const db = useDb()
  const now = new Date().toISOString()
  let fileVersion = await db.query.fileVersions.findFirst({
    where: and(
      eq(fileVersions.fileProjectId, project.id),
      eq(fileVersions.channel, channel),
      eq(fileVersions.environment, environment),
      eq(fileVersions.version, version)
    )
  })

  if (fileVersion) {
    const [updated] = await db.update(fileVersions)
      .set({
        releaseNotes: body.releaseNotes?.trim() || fileVersion.releaseNotes,
        visibility,
        updatedAt: now
      })
      .where(eq(fileVersions.id, fileVersion.id))
      .returning()
    fileVersion = updated
  } else {
    const [created] = await db.insert(fileVersions).values({
      fileProjectId: project.id,
      version,
      versionNormalized: normalizeVersion(version),
      channel,
      environment,
      status: 'draft',
      releaseNotes: body.releaseNotes?.trim() || null,
      fileName: '',
      objectKey: createPendingFileObjectKey(project.slug, version),
      bucket: '',
      endpoint: null,
      size: 0,
      sha256: null,
      mimeType: null,
      visibility,
      createdBy: null,
      updatedAt: now
    }).returning()
    fileVersion = created
  }

  const oss = await resolveUploadStorageConfig(body.storageConfigId ? Number(body.storageConfigId) : undefined)
  const objectKey = createFileReleaseObjectKey({
    fileSlug: project.slug,
    version,
    channel,
    environment,
    fileName
  }, oss)
  const contentType = body.contentType || 'application/octet-stream'
  const uploadRequest = createSignedUploadRequest(objectKey, contentType, oss)

  await writeAuditLog(event, {
    action: 'ci.file_release.prepare',
    resourceType: 'file_version',
    resourceId: fileVersion.id,
    metadata: {
      fileProjectId: project.id,
      version,
      channel,
      environment,
      fileName
    }
  })

  return {
    project,
    version: fileVersion,
    upload: serializeUploadRequest({
      objectKey,
      storageConfigId: oss.id || null,
      bucket: oss.bucket,
      endpoint: oss.endpoint,
      uploadRequest
    })
  }
}

export async function completeCiFileRelease(event: Parameters<typeof writeAuditLog>[0], fileSlug: string, body: {
  versionId?: number
  version?: string
  channel?: string
  environment?: string
  publish?: boolean
  file?: CiFileCompleteInput
}) {
  await requireCiApiToken(event)

  const project = await getCiFileProjectBySlug(fileSlug)
  const db = useDb()
  const fileVersion = body.versionId
    ? await getFileVersionById(Number(body.versionId))
    : await db.query.fileVersions.findFirst({
        where: and(
          eq(fileVersions.fileProjectId, project.id),
          eq(fileVersions.channel, body.channel?.trim() || project.defaultChannel),
          eq(fileVersions.environment, body.environment?.trim() || 'prod'),
          eq(fileVersions.version, assertVersion(body.version))
        )
      })

  if (!fileVersion || fileVersion.fileProjectId !== project.id) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File version not found'
    })
  }

  const file = body.file

  if (!file?.objectKey || !file.fileName || !file.size) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File object information is required'
    })
  }

  const oss = file.storageConfigId
    ? await getStorageConfigById(Number(file.storageConfigId))
    : requireOssConfig()
  const [updated] = await db.update(fileVersions)
    .set({
      storageConfigId: file.storageConfigId ? Number(file.storageConfigId) : null,
      fileName: file.fileName,
      objectKey: file.objectKey,
      bucket: file.bucket || oss.bucket,
      endpoint: file.endpoint || oss.endpoint || null,
      size: Number(file.size),
      sha256: file.sha256 || null,
      mimeType: file.mimeType || null,
      updatedAt: new Date().toISOString()
    })
    .where(eq(fileVersions.id, fileVersion.id))
    .returning()

  const published = body.publish
    ? await publishFileVersion({
        ...updated,
        project
      })
    : null

  await writeAuditLog(event, {
    action: body.publish ? 'ci.file_release.complete_publish' : 'ci.file_release.complete',
    resourceType: 'file_version',
    resourceId: updated.id,
    metadata: {
      fileProjectId: project.id,
      version: updated.version,
      channel: updated.channel,
      environment: updated.environment,
      fileName: updated.fileName,
      objectKey: updated.objectKey,
      published: Boolean(body.publish)
    }
  })

  return {
    project,
    version: updated,
    published
  }
}
