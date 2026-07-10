# File Update Nuxt

File Update Nuxt is a release management platform built with Nuxt, Nuxt UI, Drizzle ORM, and SQLite/libSQL. It is designed for Electron auto updates, ordinary file releases, direct object-storage uploads, download/client analytics, and CI/CD automated publishing.

中文文档: [README.md](README.md)

## Features

- Dashboard: app, version, file project, active release, update-check, download, and client-event summaries.
- Electron app management: create apps, manage versions, upload update artifacts, publish, roll back, and revoke releases.
- Electron update endpoints: supports `latest.yml`, `latest-mac.yml`, `latest-linux.yml`, and public update-check APIs.
- Ordinary file releases: create file projects, manage file versions, share pages, latest-version API, download API, and update-check API.
- Object storage: multiple storage profiles, direct uploads, signed downloads, public CDN domains, and anti-leech protection.
- Analytics: download stats, update-check stats, client event reporting, platform/version/client activity analysis.
- CI/CD automation: CI can call `/api/ci/*` endpoints to request upload URLs, upload directly to object storage, register metadata, and publish automatically.
- Audit logs: records admin operations and CI release operations.
- Admin sessions: admin APIs require login, with sessions handled by `nuxt-auth-utils`.

## Storage Support

Tested providers:

- Aliyun OSS
- UPYUN USS

Supported by design:

- Tencent COS
- Qiniu Kodo
- AWS S3

Storage capabilities:

- Direct object-storage uploads
- Signed upload URLs
- Signed download URLs
- Public access domains
- UPYUN CDN token anti-leech protection: only fill the token when UPYUN CDN anti-leech is enabled; leave it empty otherwise
- Storage verification: uploads a test object and verifies that it is accessible

## Tech Stack

- Nuxt 4
- Nuxt UI 4
- Drizzle ORM
- SQLite/libSQL
- nuxt-auth-utils
- PM2 / Docker deployment support

## Requirements

- Node.js 20+
- pnpm
- SQLite/libSQL file database. The default database path is `./data/app.db`.

## Install Dependencies

```bash
pnpm install
```

## Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Main configuration:

```env
# Session encryption secret. Use at least 32 random characters in production.
NUXT_SESSION_PASSWORD=

# SQLite/libSQL database URL. The default local database is data/app.db.
DATABASE_URL=file:./data/app.db

# Signed download URL lifetime in seconds.
DOWNLOAD_URL_EXPIRES_SECONDS=600

# Require token for public Electron update-check APIs.
UPDATE_TOKEN_REQUIRED=false

# Require token for public ordinary-file update/download APIs.
FILE_UPDATE_TOKEN_REQUIRED=false

# Plain CI/CD API token, useful for local development.
CI_API_TOKEN=

# SHA-256 hex digest of the CI/CD API token. Recommended for production.
CI_API_TOKEN_SHA256=
```

Notes:

- Object storage is not configured through `.env`; add and verify storage profiles in the admin UI.
- The administrator account is not created from `.env`; initialize it manually through `/setup` or `/api/setup/admin`.
- `CI_API_TOKEN_SHA256` is recommended for production. It should be the SHA-256 hex digest of the CI token. `CI_API_TOKEN` is convenient for local development.

## Database Generation

The recommended way is to use Drizzle migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

Command details:

- `pnpm db:generate`: generates migration files from [db/schema.ts](db/schema.ts).
- `pnpm db:migrate`: applies migrations from [db/migrations](db/migrations) to the database configured by `DATABASE_URL`.

For a fresh database, you can also use the complete SQL script:

```bash
sqlite3 ./data/app.db < docs/database.sql
```

The complete schema SQL is available at [docs/database.sql](docs/database.sql).

## Administrator Initialization

After starting the app, open:

```text
http://localhost:3000/setup
```

Or call the setup API:

```bash
curl -X POST "http://localhost:3000/api/setup/admin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password-at-least-8-chars",
    "name": "Administrator"
  }'
```

Notes:

- The password must contain at least 8 characters.
- Administrator setup is only allowed when the database has no users.
- After setup, sign in from `/login`.

## Development and Build

Start the development server:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

## Docker Build and Run

Build the image:

```bash
docker build -t file-update-nuxt:latest .
```

Run the container:

```bash
docker run -d \
  --name file-update-nuxt \
  -p 3000:3000 \
  -v file-update-data:/app/data \
  -e NUXT_SESSION_PASSWORD=your-random-session-secret-at-least-32-chars \
  file-update-nuxt:latest
```

Container defaults:

- Server port: `3000`
- Database URL: `file:/app/data/app.db`
- Persistent data directory: `/app/data`
- Run database migrations on startup: `RUN_DB_MIGRATIONS=true`
- The Node server is started and managed by `pm2-runtime`

If you want to manage database migrations manually, set:

```bash
-e RUN_DB_MIGRATIONS=false
```

## CI/CD

CI/CD API documentation: [docs/ci-cd-api.md](docs/ci-cd-api.md).

Client event reporting API documentation: [docs/client-events-api.md](docs/client-events-api.md).

## Screenshots

### Dashboard

![Dashboard](docs/dashboard.png)

### Analytics

![Analytics](docs/data-count.png)

### Electron App Details

![Electron app details](docs/exe-detail.png)

### Add Storage Configuration

![Add storage configuration](docs/add-storage-config.png)

### Upload Version Files

![Upload version files](docs/upload-version-files.png)

### Delete Version

![Delete version](docs/delete-version.png)

## Project Structure

```text
app/           Nuxt frontend pages, layouts, and styles
server/api/    Nitro API routes
server/utils/  Server utilities and business logic
server/routes/ Electron updater compatible routes
db/            Drizzle schema and migrations
docs/          API docs, database SQL, and images
data/          Default SQLite database directory
```
