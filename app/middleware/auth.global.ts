export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/login', '/setup']
  const isPublicShareRoute = to.path.startsWith('/share/')

  if (isPublicShareRoute) {
    return
  }

  const sessionFetched = useState('auth:session-fetched', () => false)
  const { loggedIn, fetch } = useUserSession()

  if (!sessionFetched.value) {
    await fetch()
    sessionFetched.value = true
  }

  if (publicRoutes.includes(to.path)) {
    if (loggedIn.value) {
      return navigateTo('/dashboard')
    }

    return
  }

  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
