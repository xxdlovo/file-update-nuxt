import { fileVersions } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)

  const projectId = parseIntegerParam(getRouterParam(event, 'projectId'), 'projectId')
  const project = await getFileProjectById(projectId)
  const body = await readBody<{
    version?: string
    channel?: string
    environment?: string
    releaseNotes?: string
    visibility?: string
  }>(event)
  const version = body.version?.trim()

  if (!version) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Version is required'
    })
  }

  const channel = body.channel?.trim() || project.defaultChannel
  const environment = body.environment?.trim() || 'prod'
  const visibility = body.visibility?.trim() || 'signed'

  if (!['signed', 'public'].includes(visibility)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid visibility'
    })
  }

  const db = useDb()

  try {
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
      createdBy: session.user.id
    }).returning()

    await writeAuditLog(event, {
      action: 'file_version.create',
      resourceType: 'file_version',
      resourceId: created.id,
      metadata: {
        fileProjectId: project.id,
        version: created.version,
        channel: created.channel,
        environment: created.environment
      }
    })

    return created
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'File version already exists for this channel and environment'
    })
  }
})
