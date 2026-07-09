import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export function hashCiApiToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function firstConfiguredValue(...values: Array<unknown>) {
  for (const value of values) {
    const text = String(value || '').trim()

    if (text) {
      return text
    }
  }

  return ''
}

export async function requireCiApiToken(event: H3Event) {
  const config = useRuntimeConfig()
  const header = getHeader(event, 'authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'CI API token is required'
    })
  }

  const expectedHash = firstConfiguredValue(
    config.ciApiTokenHash,
    process.env.NUXT_CI_API_TOKEN_HASH,
    process.env.CI_API_TOKEN_SHA256
  )
  const expectedRaw = firstConfiguredValue(
    config.ciApiToken,
    process.env.NUXT_CI_API_TOKEN,
    process.env.CI_API_TOKEN
  )
  const actualHash = hashCiApiToken(token)
  const allowedHash = expectedHash || (expectedRaw ? hashCiApiToken(expectedRaw) : '')

  if (!allowedHash) {
    throw createError({
      statusCode: 503,
      statusMessage: 'CI API token is not configured'
    })
  }

  const actual = Buffer.from(actualHash, 'hex')
  const expected = Buffer.from(allowedHash, 'hex')

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid CI API token'
    })
  }

  return {
    tokenHash: actualHash
  }
}
