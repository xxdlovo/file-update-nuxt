PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (email);

CREATE TABLE IF NOT EXISTS storage_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'aliyun_oss',
  region TEXT NOT NULL,
  access_key_id TEXT NOT NULL,
  access_key_secret TEXT NOT NULL,
  bucket TEXT NOT NULL,
  endpoint TEXT,
  public_base_url TEXT,
  cdn_auth_token TEXT,
  upload_dir TEXT NOT NULL DEFAULT 'electron-updates',
  file_release_dir TEXT NOT NULL DEFAULT 'files',
  enabled INTEGER NOT NULL DEFAULT 1,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  last_verify_status TEXT,
  last_verify_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_configs_name_unique
  ON storage_configs (name);

CREATE INDEX IF NOT EXISTS storage_configs_provider_verified_idx
  ON storage_configs (provider, enabled, verified);

CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  default_channel TEXT NOT NULL DEFAULT 'latest',
  secret_hash TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS apps_slug_unique
  ON apps (slug);

CREATE UNIQUE INDEX IF NOT EXISTS apps_bundle_id_unique
  ON apps (bundle_id);

CREATE TABLE IF NOT EXISTS app_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  app_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  version_normalized TEXT NOT NULL,
  build_number TEXT,
  channel TEXT NOT NULL DEFAULT 'latest',
  status TEXT NOT NULL DEFAULT 'draft',
  force_update INTEGER NOT NULL DEFAULT 0,
  release_notes TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES apps (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS app_versions_app_channel_version_unique
  ON app_versions (app_id, channel, version);

CREATE INDEX IF NOT EXISTS app_versions_app_status_idx
  ON app_versions (app_id, status);

CREATE TABLE IF NOT EXISTS update_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  app_id INTEGER NOT NULL,
  version_id INTEGER NOT NULL,
  storage_config_id INTEGER,
  platform TEXT NOT NULL,
  arch TEXT NOT NULL,
  package_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  bucket TEXT NOT NULL,
  endpoint TEXT,
  size INTEGER NOT NULL,
  sha256 TEXT,
  sha512 TEXT,
  mime_type TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES apps (id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES app_versions (id) ON DELETE CASCADE,
  FOREIGN KEY (storage_config_id) REFERENCES storage_configs (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS update_files_version_idx
  ON update_files (version_id);

CREATE INDEX IF NOT EXISTS update_files_target_idx
  ON update_files (app_id, platform, arch, package_type);

CREATE UNIQUE INDEX IF NOT EXISTS update_files_object_key_unique
  ON update_files (object_key);

CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  app_id INTEGER NOT NULL,
  version_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'latest',
  platform TEXT NOT NULL,
  arch TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES apps (id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES app_versions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS releases_lookup_idx
  ON releases (app_id, channel, platform, arch, active);

CREATE TABLE IF NOT EXISTS file_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT,
  default_channel TEXT NOT NULL DEFAULT 'stable',
  secret_hash TEXT,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS file_projects_slug_unique
  ON file_projects (slug);

CREATE INDEX IF NOT EXISTS file_projects_category_idx
  ON file_projects (category);

CREATE TABLE IF NOT EXISTS file_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  file_project_id INTEGER NOT NULL,
  storage_config_id INTEGER,
  version TEXT NOT NULL,
  version_normalized TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'stable',
  environment TEXT NOT NULL DEFAULT 'prod',
  status TEXT NOT NULL DEFAULT 'draft',
  release_notes TEXT,
  file_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  bucket TEXT NOT NULL,
  endpoint TEXT,
  size INTEGER NOT NULL,
  sha256 TEXT,
  mime_type TEXT,
  visibility TEXT NOT NULL DEFAULT 'signed',
  download_count INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_project_id) REFERENCES file_projects (id) ON DELETE CASCADE,
  FOREIGN KEY (storage_config_id) REFERENCES storage_configs (id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS file_versions_project_target_version_unique
  ON file_versions (file_project_id, channel, environment, version);

CREATE UNIQUE INDEX IF NOT EXISTS file_versions_object_key_unique
  ON file_versions (object_key);

CREATE INDEX IF NOT EXISTS file_versions_project_status_idx
  ON file_versions (file_project_id, status);

CREATE TABLE IF NOT EXISTS file_releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  file_project_id INTEGER NOT NULL,
  file_version_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'stable',
  environment TEXT NOT NULL DEFAULT 'prod',
  active INTEGER NOT NULL DEFAULT 1,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_project_id) REFERENCES file_projects (id) ON DELETE CASCADE,
  FOREIGN KEY (file_version_id) REFERENCES file_versions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS file_releases_lookup_idx
  ON file_releases (file_project_id, channel, environment, active);

CREATE TABLE IF NOT EXISTS file_download_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  file_project_id INTEGER NOT NULL,
  file_version_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  environment TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'api',
  file_name TEXT NOT NULL,
  user_agent TEXT,
  referer TEXT,
  ip_hash TEXT,
  token_provided INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_project_id) REFERENCES file_projects (id) ON DELETE CASCADE,
  FOREIGN KEY (file_version_id) REFERENCES file_versions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS file_download_events_project_created_idx
  ON file_download_events (file_project_id, created_at);

CREATE INDEX IF NOT EXISTS file_download_events_version_created_idx
  ON file_download_events (file_version_id, created_at);

CREATE INDEX IF NOT EXISTS file_download_events_source_idx
  ON file_download_events (source);

CREATE TABLE IF NOT EXISTS file_update_check_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  file_project_id INTEGER NOT NULL,
  file_version_id INTEGER,
  channel TEXT NOT NULL,
  environment TEXT NOT NULL,
  current_version TEXT,
  update_available INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'api',
  user_agent TEXT,
  referer TEXT,
  ip_hash TEXT,
  token_provided INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_project_id) REFERENCES file_projects (id) ON DELETE CASCADE,
  FOREIGN KEY (file_version_id) REFERENCES file_versions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS file_update_check_events_project_created_idx
  ON file_update_check_events (file_project_id, created_at);

CREATE INDEX IF NOT EXISTS file_update_check_events_version_created_idx
  ON file_update_check_events (file_version_id, created_at);

CREATE INDEX IF NOT EXISTS file_update_check_events_source_idx
  ON file_update_check_events (source);

CREATE TABLE IF NOT EXISTS app_update_check_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  app_id INTEGER NOT NULL,
  app_version_id INTEGER,
  channel TEXT NOT NULL,
  platform TEXT NOT NULL,
  arch TEXT NOT NULL,
  current_version TEXT,
  update_available INTEGER NOT NULL DEFAULT 0,
  files_issued INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'api',
  user_agent TEXT,
  referer TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES apps (id) ON DELETE CASCADE,
  FOREIGN KEY (app_version_id) REFERENCES app_versions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS app_update_check_events_app_created_idx
  ON app_update_check_events (app_id, created_at);

CREATE INDEX IF NOT EXISTS app_update_check_events_version_created_idx
  ON app_update_check_events (app_version_id, created_at);

CREATE INDEX IF NOT EXISTS app_update_check_events_target_idx
  ON app_update_check_events (app_id, channel, platform, arch);

CREATE INDEX IF NOT EXISTS app_update_check_events_source_idx
  ON app_update_check_events (source);

CREATE TABLE IF NOT EXISTS file_client_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  file_project_id INTEGER NOT NULL,
  file_version_id INTEGER,
  event_type TEXT NOT NULL,
  client_id TEXT,
  client_name TEXT,
  client_version TEXT,
  platform TEXT,
  arch TEXT,
  channel TEXT NOT NULL DEFAULT 'stable',
  environment TEXT NOT NULL DEFAULT 'prod',
  current_version TEXT,
  startup_duration_ms INTEGER,
  duration_ms INTEGER,
  bytes INTEGER,
  metadata TEXT,
  source TEXT NOT NULL DEFAULT 'client',
  user_agent TEXT,
  referer TEXT,
  ip_hash TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_project_id) REFERENCES file_projects (id) ON DELETE CASCADE,
  FOREIGN KEY (file_version_id) REFERENCES file_versions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS file_client_events_project_created_idx
  ON file_client_events (file_project_id, created_at);

CREATE INDEX IF NOT EXISTS file_client_events_version_created_idx
  ON file_client_events (file_version_id, created_at);

CREATE INDEX IF NOT EXISTS file_client_events_type_idx
  ON file_client_events (event_type);

CREATE INDEX IF NOT EXISTS file_client_events_client_idx
  ON file_client_events (client_id);

CREATE INDEX IF NOT EXISTS file_client_events_target_idx
  ON file_client_events (file_project_id, channel, environment);

CREATE TABLE IF NOT EXISTS app_client_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  app_id INTEGER NOT NULL,
  app_version_id INTEGER,
  event_type TEXT NOT NULL,
  client_id TEXT,
  client_name TEXT,
  client_version TEXT,
  platform TEXT,
  arch TEXT,
  channel TEXT NOT NULL DEFAULT 'latest',
  current_version TEXT,
  startup_duration_ms INTEGER,
  duration_ms INTEGER,
  bytes INTEGER,
  metadata TEXT,
  source TEXT NOT NULL DEFAULT 'client',
  user_agent TEXT,
  referer TEXT,
  ip_hash TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES apps (id) ON DELETE CASCADE,
  FOREIGN KEY (app_version_id) REFERENCES app_versions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS app_client_events_app_created_idx
  ON app_client_events (app_id, created_at);

CREATE INDEX IF NOT EXISTS app_client_events_version_created_idx
  ON app_client_events (app_version_id, created_at);

CREATE INDEX IF NOT EXISTS app_client_events_type_idx
  ON app_client_events (event_type);

CREATE INDEX IF NOT EXISTS app_client_events_client_idx
  ON app_client_events (client_id);

CREATE INDEX IF NOT EXISTS app_client_events_target_idx
  ON app_client_events (app_id, channel, platform, arch);

CREATE TABLE IF NOT EXISTS file_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  file_project_id INTEGER NOT NULL,
  file_version_id INTEGER,
  client_id TEXT NOT NULL,
  client_name TEXT,
  client_version TEXT,
  platform TEXT,
  arch TEXT,
  channel TEXT NOT NULL DEFAULT 'stable',
  environment TEXT NOT NULL DEFAULT 'prod',
  current_version TEXT,
  last_event_type TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  startup_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  total_startup_duration_ms INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_hash TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_project_id) REFERENCES file_projects (id) ON DELETE CASCADE,
  FOREIGN KEY (file_version_id) REFERENCES file_versions (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS file_clients_project_client_unique
  ON file_clients (file_project_id, client_id);

CREATE INDEX IF NOT EXISTS file_clients_project_last_seen_idx
  ON file_clients (file_project_id, last_seen_at);

CREATE INDEX IF NOT EXISTS file_clients_version_idx
  ON file_clients (file_version_id);

CREATE INDEX IF NOT EXISTS file_clients_target_idx
  ON file_clients (file_project_id, channel, environment);

CREATE TABLE IF NOT EXISTS app_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  app_id INTEGER NOT NULL,
  app_version_id INTEGER,
  client_id TEXT NOT NULL,
  client_name TEXT,
  client_version TEXT,
  platform TEXT,
  arch TEXT,
  channel TEXT NOT NULL DEFAULT 'latest',
  current_version TEXT,
  last_event_type TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  startup_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  total_startup_duration_ms INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_hash TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES apps (id) ON DELETE CASCADE,
  FOREIGN KEY (app_version_id) REFERENCES app_versions (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS app_clients_app_client_unique
  ON app_clients (app_id, client_id);

CREATE INDEX IF NOT EXISTS app_clients_app_last_seen_idx
  ON app_clients (app_id, last_seen_at);

CREATE INDEX IF NOT EXISTS app_clients_version_idx
  ON app_clients (app_version_id);

CREATE INDEX IF NOT EXISTS app_clients_target_idx
  ON app_clients (app_id, channel, platform, arch);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_user_idx
  ON audit_logs (user_id);

CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
  ON audit_logs (resource_type, resource_id);

COMMIT;
