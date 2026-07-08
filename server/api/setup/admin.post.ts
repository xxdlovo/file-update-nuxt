export default defineEventHandler(async (event) => {
  const existingUsers = await countUsers()

  if (existingUsers > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Administrator already initialized'
    })
  }

  const body = await readBody<{
    email?: string
    password?: string
    name?: string
  }>(event)

  const email = body.email?.trim().toLowerCase()
  const password = body.password || ''

  if (!email || !email.includes('@')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid email is required'
    })
  }

  if (password.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 8 characters'
    })
  }

  const user = await createAdminUser({
    email,
    password,
    name: body.name
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  }
})
