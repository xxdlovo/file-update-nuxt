import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const keyLength = 64

export async function hashLocalPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await scryptAsync(password, salt, keyLength) as Buffer

  return `scrypt:${salt}:${key.toString('hex')}`
}

export async function verifyLocalPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedKey] = passwordHash.split(':')

  if (algorithm !== 'scrypt' || !salt || !storedKey) {
    return false
  }

  const key = await scryptAsync(password, salt, keyLength) as Buffer
  const stored = Buffer.from(storedKey, 'hex')

  return stored.length === key.length && timingSafeEqual(stored, key)
}
