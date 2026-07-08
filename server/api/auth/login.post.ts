export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email?: string
    password?: string
  }>(event)

  const email = body.email?.trim().toLowerCase()
  const password = body.password || ''

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required'
    })
  }

  const user = await findUserByEmail(email)

  if (!user || !(await verifyLocalPassword(password, user.passwordHash))) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password'
    })
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    secure: {
      userId: user.id
    },
    loggedInAt: new Date().toISOString()
  })

  await writeAuditLog(event, {
    userId: user.id,
    action: 'login',
    resourceType: 'user',
    resourceId: user.id,
    metadata: {
      email: user.email
    }
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
