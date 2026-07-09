import type { H3Event } from 'h3'

export async function buildElectronUpdaterMetadata(event: H3Event) {
  const appSlug = getRouterParam(event, 'appSlug') || ''
  const platform = getRouterParam(event, 'platform') || ''
  const channel = getRouterParam(event, 'channel') || ''
  const query = getQuery(event)
  const arch = String(query.arch || 'x64')
  const release = await getActiveAppRelease({
    appSlug,
    platform,
    channel,
    arch
  })

  if (!release) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Release not found'
    })
  }

  const files = await Promise.all(release.files
    .filter(file => file.packageType !== 'metadata')
    .map(async file => ({
      url: await createSignedDownloadUrl(file.objectKey, file.storageConfigId),
      sha512: file.sha512,
      size: file.size
    })))

  const primaryFile = files.find(file => file.sha512) || files[0]

  if (!primaryFile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Release has no downloadable files'
    })
  }

  await recordAppUpdateCheck({
    appId: release.appId,
    versionId: release.version.id,
    channel,
    platform,
    arch,
    updateAvailable: true,
    filesIssued: files.length,
    event,
    source: 'electron-updater'
  })

  setHeader(event, 'Content-Type', 'text/yaml; charset=utf-8')

  return [
    `version: ${yamlString(release.version.version)}`,
    `releaseDate: ${yamlString(release.publishedAt)}`,
    `path: ${yamlString(primaryFile.url)}`,
    primaryFile.sha512 ? `sha512: ${yamlString(primaryFile.sha512)}` : '',
    `files:`,
    ...files.map(file => [
      `  - url: ${yamlString(file.url)}`,
      file.sha512 ? `    sha512: ${yamlString(file.sha512)}` : '',
      `    size: ${file.size}`
    ].filter(Boolean).join('\n'))
  ].filter(Boolean).join('\n')
}

function yamlString(value: string | null) {
  return JSON.stringify(value || '')
}
