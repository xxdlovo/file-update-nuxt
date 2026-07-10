import { asc } from 'drizzle-orm'
import { apps, fileProjects } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const db = useDb()
  const [appItems, fileItems] = await Promise.all([
    db.query.apps.findMany({
      orderBy: [asc(apps.name)]
    }),
    db.query.fileProjects.findMany({
      orderBy: [asc(fileProjects.name)]
    })
  ])

  return {
    apps: appItems.map(app => ({
      id: app.id,
      name: app.name,
      slug: app.slug,
      enabled: app.enabled,
      defaultChannel: app.defaultChannel
    })),
    files: fileItems.map(project => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      enabled: project.enabled,
      defaultChannel: project.defaultChannel
    }))
  }
})
