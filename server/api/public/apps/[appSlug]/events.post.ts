export default defineEventHandler(async (event) => {
  const appSlug = getRouterParam(event, 'appSlug') || ''
  const app = await getEnabledAppBySlug(appSlug)

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Application not found'
    })
  }

  const created = await recordAppClientEvent(event, app, await readBody(event) || {})

  return {
    ok: true,
    eventId: created?.id || null,
    appId: app.id,
    versionId: created?.appVersionId || null
  }
})
