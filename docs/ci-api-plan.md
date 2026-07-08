# CI/CD API Plan

## Authentication

All CI endpoints use `Authorization: Bearer <token>`.

The preferred configuration is `CI_API_TOKEN_SHA256`, a SHA-256 hex digest of the token. `CI_API_TOKEN` remains available for local development compatibility.

Validation helper:

- `requireCiApiToken(event)`
- Probe endpoint: `GET /api/ci/ping`

## Electron Automation

Planned endpoints:

- `POST /api/ci/apps/:appSlug/versions`
  - Creates or returns a draft Electron version.
  - Body: `version`, `buildNumber`, `channel`, `forceUpdate`, `releaseNotes`.
- `POST /api/ci/apps/:appSlug/versions/:version/upload-token`
  - Creates a signed upload URL for a platform artifact.
  - Body: `storageConfigId`, `platform`, `arch`, `packageType`, `fileName`, `contentType`.
- `POST /api/ci/apps/:appSlug/versions/:version/complete`
  - Confirms uploaded file metadata.
  - Body: `objectKey`, `bucket`, `endpoint`, `size`, `sha256`, `sha512`, `mimeType`.
- `POST /api/ci/apps/:appSlug/versions/:version/publish`
  - Publishes the version to release pointers.
  - Body: optional `targets`.

## Ordinary File Automation

Planned endpoints:

- `POST /api/ci/files/:fileSlug/versions`
  - Creates or returns a draft file version.
  - Body: `version`, `channel`, `environment`, `releaseNotes`.
- `POST /api/ci/files/:fileSlug/versions/:version/upload-token`
  - Creates a signed upload URL for the file body.
  - Body: `storageConfigId`, `fileName`, `contentType`.
- `POST /api/ci/files/:fileSlug/versions/:version/complete`
  - Confirms uploaded file metadata.
  - Body: `objectKey`, `bucket`, `endpoint`, `size`, `sha256`, `mimeType`.
- `POST /api/ci/files/:fileSlug/versions/:version/publish`
  - Publishes the version to the active file release pointer.

## MVP Rules

- CI endpoints must reuse existing version, upload, complete, publish, and audit logic.
- CI endpoints must not delete OSS objects.
- If an endpoint receives duplicate version input, it should return the existing draft when possible and fail only on incompatible target metadata.
- Publish operations must write audit logs with `resourceType` and version identifiers.
