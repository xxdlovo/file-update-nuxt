export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  return {
    loggedIn: Boolean(session.user),
    user: session.user || null
  }
})
