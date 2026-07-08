export default defineEventHandler(async () => {
  const existingUsers = await countUsers()

  return {
    initialized: existingUsers > 0
  }
})
