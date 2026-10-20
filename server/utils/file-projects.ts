import { eq, like, or } from 'drizzle-orm'
import { fileProjects } from '../../db/schema'

export function buildFileProjectSearchWhere(search: string) {
  const value = `%${search}%`

  return or(
    like(fileProjects.name, value),
    like(fileProjects.slug, value),
    like(fileProjects.category, value)
  )
}

export const fileVisibilityValues = ['signed', 'public'] as const

export type FileVisibility = typeof fileVisibilityValues[number]

export function normalizeFileVisibility(value: string | null | undefined, fallback: FileVisibility = 'signed'): FileVisibility {
  const visibility = value?.trim() || fallback

  if (!fileVisibilityValues.includes(visibility as FileVisibility)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid visibility'
    })
  }

  return visibility as FileVisibility
}

export async function getFileProjectById(id: number) {
  const db = useDb()
  const project = await db.query.fileProjects.findFirst({
    where: eq(fileProjects.id, id)
  })

  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File project not found'
    })
  }

  return project
}

