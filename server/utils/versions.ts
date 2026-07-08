import { eq } from 'drizzle-orm'
import { appVersions } from '../../db/schema'

export function normalizeVersion(version: string) {
  const trimmed = version.trim()
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(trimmed)

  if (!match) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Version must use semantic format like 1.2.0'
    })
  }

  return match
    .slice(1)
    .map(part => part.padStart(8, '0'))
    .join('.')
}

export async function getAppVersionById(id: number) {
  const db = useDb()
  const version = await db.query.appVersions.findFirst({
    where: eq(appVersions.id, id),
    with: {
      app: true
    }
  })

  if (!version) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Version not found'
    })
  }

  return version
}

export function normalizeVersionStatus(status: string | undefined) {
  if (!status) {
    return 'draft'
  }

  if (!['draft', 'published', 'revoked'].includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid version status'
    })
  }

  return status
}
