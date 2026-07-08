import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '../../db/schema'

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined

export function useDb() {
  if (!cachedDb) {
    const config = useRuntimeConfig()
    const client = createClient({
      url: config.databaseUrl
    })

    cachedDb = drizzle(client, { schema })
  }

  return cachedDb
}
