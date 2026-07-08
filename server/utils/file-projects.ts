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

