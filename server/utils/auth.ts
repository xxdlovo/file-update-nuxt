import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { users } from '../../db/schema'

export async function requireAdminSession(event: H3Event) {
  const session = await requireUserSession(event)

  if (session.user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  return session
}

export async function findUserByEmail(email: string) {
  const db = useDb()
  const normalizedEmail = email.trim().toLowerCase()

  return db.query.users.findFirst({
    where: eq(users.email, normalizedEmail)
  })
}

export async function countUsers() {
  const db = useDb()
  const rows = await db.select({ id: users.id }).from(users).limit(1)

  return rows.length
}

export async function createAdminUser(input: {
  email: string
  password: string
  name?: string
}) {
  const db = useDb()
  const email = input.email.trim().toLowerCase()
  const passwordHash = await hashLocalPassword(input.password)
  const [user] = await db.insert(users).values({
    email,
    passwordHash,
    name: input.name?.trim() || 'Administrator',
    role: 'admin'
  }).returning()

  return user
}
