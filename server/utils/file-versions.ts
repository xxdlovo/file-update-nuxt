import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { fileVersions } from '../../db/schema'

export async function getFileVersionById(id: number) {
  const db = useDb()
  const version = await db.query.fileVersions.findFirst({
    where: eq(fileVersions.id, id),
    with: {
      project: true
    }
  })

  if (!version) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File version not found'
    })
  }

  return version
}

export function normalizeFileVersionStatus(status: string | undefined) {
  if (!status) {
    return 'draft'
  }

  if (!['draft', 'published', 'revoked'].includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file version status'
    })
  }

  return status
}

export function createPendingFileObjectKey(projectSlug: string, version: string) {
  return [
    'pending-file-versions',
    projectSlug,
    version,
    `${Date.now()}-${randomUUID()}`
  ].join('/')
}
