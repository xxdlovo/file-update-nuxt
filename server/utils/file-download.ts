import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createReadStream, createWriteStream, promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import type { H3Event } from 'h3'

const passThroughHeaders = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified'
]

/**
 * 生成 Content-Disposition，让浏览器用原始文件名保存。
 * filename* 负责中文等非 ASCII 文件名，filename 只作为老客户端兜底。
 */
export function buildAttachmentContentDisposition(fileName: string) {
  const safeName = (fileName || 'download').replace(/[\r\n]/g, '')
  const fallback = safeName
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\/]/g, '_')
    .trim()
    .slice(0, 120) || 'download'
  const encoded = encodeURIComponent(safeName || 'download')
    .replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

function getCacheOptions() {
  const config = useRuntimeConfig()

  return {
    enabled: config.downloadCacheEnabled !== false,
    dir: String(config.downloadCacheDir || './data/download-cache'),
    maxFileBytes: Number(config.downloadCacheMaxFileBytes || 0),
    maxTotalBytes: Number(config.downloadCacheMaxBytes || 0)
  }
}

function normalizeCacheKey(value: string | null | undefined) {
  const key = String(value || '').trim().toLowerCase()

  return /^[a-f0-9]{64}$/.test(key) ? key : ''
}

function cacheFilePath(dir: string, key: string) {
  return join(dir, key.slice(0, 2), `${key}.bin`)
}

async function findCachedFile(key: string, expectedSize: number) {
  const options = getCacheOptions()

  if (!options.enabled || !key) {
    return null
  }

  const path = cacheFilePath(options.dir, key)

  try {
    const stat = await fs.stat(path)

    if (!stat.isFile() || stat.size <= 0) {
      return null
    }

    if (expectedSize > 0 && stat.size !== expectedSize) {
      await fs.rm(path, { force: true })
      return null
    }

    // 更新 mtime，淘汰时按最近使用时间
    const now = new Date()
    await fs.utimes(path, now, now).catch(() => {})

    return { path, size: stat.size }
  } catch {
    return null
  }
}

function parseRangeHeader(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())

  if (!match) {
    return null
  }

  const [, rawStart, rawEnd] = match
  let start: number
  let end: number

  if (rawStart === '') {
    const suffixLength = Number(rawEnd)

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null
    }

    start = Math.max(size - suffixLength, 0)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return null
  }

  return { start, end }
}

async function sendCachedFile(event: H3Event, file: { path: string, size: number }, input: {
  fileName: string
  mimeType?: string | null
}) {
  setResponseHeader(event, 'content-type', input.mimeType || 'application/octet-stream')
  setResponseHeader(event, 'content-disposition', buildAttachmentContentDisposition(input.fileName))
  setResponseHeader(event, 'accept-ranges', 'bytes')
  setResponseHeader(event, 'cache-control', 'private, max-age=0, must-revalidate')

  const rangeHeader = getRequestHeader(event, 'range')
  const range = rangeHeader ? parseRangeHeader(rangeHeader, file.size) : null

  if (range) {
    setResponseStatus(event, 206)
    setResponseHeader(event, 'content-length', range.end - range.start + 1)
    setResponseHeader(event, 'content-range', `bytes ${range.start}-${range.end}/${file.size}`)

    return sendStream(event, createReadStream(file.path, { start: range.start, end: range.end }))
  }

  setResponseHeader(event, 'content-length', file.size)

  return sendStream(event, createReadStream(file.path))
}

async function pruneCache(dir: string, maxTotalBytes: number) {
  if (!(maxTotalBytes > 0)) {
    return
  }

  const entries: Array<{ path: string, size: number, mtimeMs: number }> = []

  async function walk(current: string) {
    let items

    try {
      items = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const item of items) {
      const fullPath = join(current, item.name)

      if (item.isDirectory()) {
        await walk(fullPath)
        continue
      }

      if (!item.isFile() || item.name.endsWith('.part')) {
        continue
      }

      try {
        const stat = await fs.stat(fullPath)
        entries.push({ path: fullPath, size: stat.size, mtimeMs: stat.mtimeMs })
      } catch {
        // 忽略并发删除的文件
      }
    }
  }

  await walk(dir)

  let total = entries.reduce((sum, entry) => sum + entry.size, 0)

  if (total <= maxTotalBytes) {
    return
  }

  entries.sort((a, b) => a.mtimeMs - b.mtimeMs)

  for (const entry of entries) {
    if (total <= maxTotalBytes) {
      break
    }

    await fs.rm(entry.path, { force: true }).catch(() => {})
    total -= entry.size
  }
}

/**
 * 边转发边落盘：首次下载同时写缓存，后续命中缓存直接读本地文件。
 * 返回前已经把响应写进 event.node.res。
 */
async function streamAndStore(event: H3Event, response: Response, input: {
  cacheKey: string
  expectedSize: number
}) {
  const options = getCacheOptions()
  const targetPath = cacheFilePath(options.dir, input.cacheKey)
  const tempPath = `${targetPath}.${randomUUID()}.part`

  await fs.mkdir(dirname(targetPath), { recursive: true })

  const fileStream = createWriteStream(tempPath)
  const res = event.node.res
  const hash = createHash('sha256')
  const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
  let bytes = 0
  let clientClosed = false

  res.on('close', () => {
    clientClosed = true
  })

  try {
    for await (const chunk of source) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)

      bytes += buffer.length
      hash.update(buffer)

      if (!fileStream.write(buffer)) {
        await once(fileStream, 'drain')
      }

      if (!clientClosed && !res.write(buffer)) {
        await Promise.race([once(res, 'drain'), once(res, 'close')])
      }
    }

    await new Promise<void>((resolve, reject) => {
      fileStream.end((error?: Error | null) => error ? reject(error) : resolve())
    })

    if (!clientClosed) {
      res.end()
    }

    const digest = hash.digest('hex')
    const sizeMatches = bytes > 0 && (input.expectedSize <= 0 || input.expectedSize === bytes)

    if (sizeMatches && digest === input.cacheKey) {
      await fs.rename(tempPath, targetPath)
      await pruneCache(options.dir, options.maxTotalBytes)
    } else {
      await fs.rm(tempPath, { force: true })
    }
  } catch (error) {
    fileStream.destroy()
    await fs.rm(tempPath, { force: true }).catch(() => {})

    if (!clientClosed) {
      res.destroy(error as Error)
    }

    throw error
  }
}

/**
 * 代理对象存储的下载链接：
 * - 命中 SHA-256 缓存则直接读本地文件，支持 Range；
 * - 未命中则从对象存储拉取，边发给客户端边写入缓存（只消耗一次 CDN 流量）；
 * - 响应头 Content-Disposition 使用原始文件名。
 */
export async function streamFileDownload(event: H3Event, input: {
  url: string
  fileName: string
  mimeType?: string | null
  sha256?: string | null
  size?: number | null
}) {
  const cacheKey = normalizeCacheKey(input.sha256)
  const expectedSize = Number(input.size || 0)
  const options = getCacheOptions()
  const cacheEligible = options.enabled
    && Boolean(cacheKey)
    && (options.maxFileBytes <= 0 || expectedSize <= 0 || expectedSize <= options.maxFileBytes)

  if (cacheEligible) {
    const cached = await findCachedFile(cacheKey, expectedSize)

    if (cached) {
      return sendCachedFile(event, cached, input)
    }
  }

  const requestHeaders: Record<string, string> = {}
  const rangeHeader = getRequestHeader(event, 'range')

  if (rangeHeader) {
    requestHeaders.range = rangeHeader
  }

  const response = await fetch(input.url, {
    headers: requestHeaders,
    redirect: 'follow'
  })

  if (!response.ok && response.status !== 206) {
    throw createError({
      statusCode: 502,
      statusMessage: `Download source responded with ${response.status}`
    })
  }

  setResponseStatus(event, response.status)

  const isEncoded = Boolean(response.headers.get('content-encoding'))

  for (const name of passThroughHeaders) {
    if (name === 'content-length' && isEncoded) {
      continue
    }

    const value = response.headers.get(name)

    if (value) {
      setResponseHeader(event, name, value)
    }
  }

  if (!response.headers.get('content-type')) {
    setResponseHeader(event, 'content-type', input.mimeType || 'application/octet-stream')
  }

  setResponseHeader(event, 'content-disposition', buildAttachmentContentDisposition(input.fileName))
  setResponseHeader(event, 'cache-control', 'private, max-age=0, must-revalidate')
  // 避免前置代理（nginx）缓冲整个文件，保证流式下载
  setResponseHeader(event, 'x-accel-buffering', 'no')

  if (!response.body) {
    return sendNoContent(event, response.status)
  }

  const canStore = cacheEligible && !rangeHeader && response.status === 200 && !isEncoded

  if (canStore) {
    await streamAndStore(event, response, { cacheKey, expectedSize })
    event._handled = true

    return
  }

  return sendStream(event, Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]))
}
