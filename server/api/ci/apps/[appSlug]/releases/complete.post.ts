export default defineEventHandler(async (event) => {
  const appSlug = getRouterParam(event, 'appSlug') || ''
  const body = await readBody(event)

  return completeCiElectronRelease(event, appSlug, body || {})
})
