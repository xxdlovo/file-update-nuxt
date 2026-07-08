import { eq, like, or } from 'drizzle-orm'
import { apps } from '../../db/schema'

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseIntegerParam(value: string | undefined, name = 'id') {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid ${name}`
    })
  }

  return parsed
}

export async function getAppById(id: number) {
  const db = useDb()
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, id)
  })

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Application not found'
    })
  }

  return app
}

export function buildAppSearchWhere(search: string) {
  const value = `%${search}%`

  return or(
    like(apps.name, value),
    like(apps.slug, value),
    like(apps.bundleId, value)
  )
}
