export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/login', '/setup']

  if (publicRoutes.includes(to.path)) {
    const { loggedIn, fetch } = useUserSession()
    await fetch()

    if (loggedIn.value) {
      return navigateTo('/dashboard')
    }

    return
  }

  const { loggedIn, fetch } = useUserSession()
  await fetch()

  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
