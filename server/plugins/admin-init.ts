export default defineNitroPlugin(async () => {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    return
  }

  const existingUsers = await countUsers()

  if (existingUsers > 0) {
    return
  }

  await createAdminUser({
    email: adminEmail,
    password: adminPassword,
    name: process.env.ADMIN_NAME || 'Administrator'
  })
})
