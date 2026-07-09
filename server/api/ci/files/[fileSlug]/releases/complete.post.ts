export default defineEventHandler(async (event) => {
  const fileSlug = getRouterParam(event, 'fileSlug') || ''
  const body = await readBody(event)

  return completeCiFileRelease(event, fileSlug, body || {})
})
