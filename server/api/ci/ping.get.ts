export default defineEventHandler(async (event) => {
  await requireCiApiToken(event)

  return {
    ok: true,
    scope: 'ci'
  }
})
