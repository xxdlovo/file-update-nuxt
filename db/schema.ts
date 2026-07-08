import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('admin'),
  ...timestamps
}, table => [
  uniqueIndex('users_email_unique').on(table.email)
])

export const apps = sqliteTable('apps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  bundleId: text('bundle_id').notNull(),
  defaultChannel: text('default_channel').notNull().default('latest'),
  secretHash: text('secret_hash'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  description: text('description'),
  ...timestamps
}, table => [
  uniqueIndex('apps_slug_unique').on(table.slug),
  uniqueIndex('apps_bundle_id_unique').on(table.bundleId)
])

export const appVersions = sqliteTable('app_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: integer('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  versionNormalized: text('version_normalized').notNull(),
  buildNumber: text('build_number'),
  channel: text('channel').notNull().default('latest'),
  status: text('status').notNull().default('draft'),
  forceUpdate: integer('force_update', { mode: 'boolean' }).notNull().default(false),
  releaseNotes: text('release_notes'),
  publishedAt: text('published_at'),
  ...timestamps
}, table => [
  uniqueIndex('app_versions_app_channel_version_unique').on(table.appId, table.channel, table.version),
  index('app_versions_app_status_idx').on(table.appId, table.status)
])

export const updateFiles = sqliteTable('update_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: integer('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  versionId: integer('version_id').notNull().references(() => appVersions.id, { onDelete: 'cascade' }),
  storageConfigId: integer('storage_config_id').references(() => storageConfigs.id, { onDelete: 'set null' }),
  platform: text('platform').notNull(),
  arch: text('arch').notNull(),
  packageType: text('package_type').notNull(),
  fileName: text('file_name').notNull(),
  objectKey: text('object_key').notNull(),
  bucket: text('bucket').notNull(),
  endpoint: text('endpoint'),
  size: integer('size').notNull(),
  sha256: text('sha256'),
  sha512: text('sha512'),
  mimeType: text('mime_type'),
  downloadCount: integer('download_count').notNull().default(0),
  ...timestamps
}, table => [
  index('update_files_version_idx').on(table.versionId),
  index('update_files_target_idx').on(table.appId, table.platform, table.arch, table.packageType),
  uniqueIndex('update_files_object_key_unique').on(table.objectKey)
])

export const storageConfigs = sqliteTable('storage_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  provider: text('provider').notNull().default('aliyun_oss'),
  region: text('region').notNull(),
  accessKeyId: text('access_key_id').notNull(),
  accessKeySecret: text('access_key_secret').notNull(),
  bucket: text('bucket').notNull(),
  endpoint: text('endpoint'),
  publicBaseUrl: text('public_base_url'),
  uploadDir: text('upload_dir').notNull().default('electron-updates'),
  fileReleaseDir: text('file_release_dir').notNull().default('files'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  verifiedAt: text('verified_at'),
  lastVerifyStatus: text('last_verify_status'),
  lastVerifyMessage: text('last_verify_message'),
  ...timestamps
}, table => [
  uniqueIndex('storage_configs_name_unique').on(table.name),
  index('storage_configs_provider_verified_idx').on(table.provider, table.enabled, table.verified)
])

export const releases = sqliteTable('releases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: integer('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  versionId: integer('version_id').notNull().references(() => appVersions.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull().default('latest'),
  platform: text('platform').notNull(),
  arch: text('arch').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  publishedAt: text('published_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps
}, table => [
  index('releases_lookup_idx').on(table.appId, table.channel, table.platform, table.arch, table.active)
])

export const fileProjects = sqliteTable('file_projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  category: text('category'),
  defaultChannel: text('default_channel').notNull().default('stable'),
  secretHash: text('secret_hash'),
  description: text('description'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps
}, table => [
  uniqueIndex('file_projects_slug_unique').on(table.slug),
  index('file_projects_category_idx').on(table.category)
])

export const fileVersions = sqliteTable('file_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileProjectId: integer('file_project_id').notNull().references(() => fileProjects.id, { onDelete: 'cascade' }),
  storageConfigId: integer('storage_config_id').references(() => storageConfigs.id, { onDelete: 'set null' }),
  version: text('version').notNull(),
  versionNormalized: text('version_normalized').notNull(),
  channel: text('channel').notNull().default('stable'),
  environment: text('environment').notNull().default('prod'),
  status: text('status').notNull().default('draft'),
  releaseNotes: text('release_notes'),
  fileName: text('file_name').notNull(),
  objectKey: text('object_key').notNull(),
  bucket: text('bucket').notNull(),
  endpoint: text('endpoint'),
  size: integer('size').notNull(),
  sha256: text('sha256'),
  mimeType: text('mime_type'),
  visibility: text('visibility').notNull().default('signed'),
  downloadCount: integer('download_count').notNull().default(0),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: text('published_at'),
  ...timestamps
}, table => [
  uniqueIndex('file_versions_project_target_version_unique').on(
    table.fileProjectId,
    table.channel,
    table.environment,
    table.version
  ),
  uniqueIndex('file_versions_object_key_unique').on(table.objectKey),
  index('file_versions_project_status_idx').on(table.fileProjectId, table.status)
])

export const fileReleases = sqliteTable('file_releases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileProjectId: integer('file_project_id').notNull().references(() => fileProjects.id, { onDelete: 'cascade' }),
  fileVersionId: integer('file_version_id').notNull().references(() => fileVersions.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull().default('stable'),
  environment: text('environment').notNull().default('prod'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  publishedAt: text('published_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps
}, table => [
  index('file_releases_lookup_idx').on(table.fileProjectId, table.channel, table.environment, table.active)
])

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  index('audit_logs_user_idx').on(table.userId),
  index('audit_logs_resource_idx').on(table.resourceType, table.resourceId)
])

export const usersRelations = relations(users, ({ many }) => ({
  fileVersions: many(fileVersions),
  auditLogs: many(auditLogs)
}))

export const appsRelations = relations(apps, ({ many }) => ({
  versions: many(appVersions),
  updateFiles: many(updateFiles),
  releases: many(releases)
}))

export const appVersionsRelations = relations(appVersions, ({ one, many }) => ({
  app: one(apps, {
    fields: [appVersions.appId],
    references: [apps.id]
  }),
  files: many(updateFiles),
  releases: many(releases)
}))

export const updateFilesRelations = relations(updateFiles, ({ one }) => ({
  app: one(apps, {
    fields: [updateFiles.appId],
    references: [apps.id]
  }),
  version: one(appVersions, {
    fields: [updateFiles.versionId],
    references: [appVersions.id]
  }),
  storageConfig: one(storageConfigs, {
    fields: [updateFiles.storageConfigId],
    references: [storageConfigs.id]
  })
}))

export const storageConfigsRelations = relations(storageConfigs, ({ many }) => ({
  updateFiles: many(updateFiles),
  fileVersions: many(fileVersions)
}))

export const releasesRelations = relations(releases, ({ one }) => ({
  app: one(apps, {
    fields: [releases.appId],
    references: [apps.id]
  }),
  version: one(appVersions, {
    fields: [releases.versionId],
    references: [appVersions.id]
  })
}))

export const fileProjectsRelations = relations(fileProjects, ({ many }) => ({
  versions: many(fileVersions),
  releases: many(fileReleases)
}))

export const fileVersionsRelations = relations(fileVersions, ({ one, many }) => ({
  project: one(fileProjects, {
    fields: [fileVersions.fileProjectId],
    references: [fileProjects.id]
  }),
  creator: one(users, {
    fields: [fileVersions.createdBy],
    references: [users.id]
  }),
  storageConfig: one(storageConfigs, {
    fields: [fileVersions.storageConfigId],
    references: [storageConfigs.id]
  }),
  releases: many(fileReleases)
}))

export const fileReleasesRelations = relations(fileReleases, ({ one }) => ({
  project: one(fileProjects, {
    fields: [fileReleases.fileProjectId],
    references: [fileProjects.id]
  }),
  version: one(fileVersions, {
    fields: [fileReleases.fileVersionId],
    references: [fileVersions.id]
  })
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id]
  })
}))
