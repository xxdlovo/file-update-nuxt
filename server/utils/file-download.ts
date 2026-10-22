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

/**
 * 代理对象存储的下载链接，把响应体的 Content-Disposition 改成原始文件名。
 * 支持 Range 透传，客户端可以断点续传。
 */
export async function streamFileDownload(event: H3Event, input: {
  url: string
  fileName: string
  mimeType?: string | null
}) {
  const requestHeaders: Record<string, string> = {}
  const range = getRequestHeader(event, 'range')

  if (range) {
    requestHeaders.range = range
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

  return sendStream(event, Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]))
}
