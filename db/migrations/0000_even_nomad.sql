CREATE TABLE `app_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`version` text NOT NULL,
	`version_normalized` text NOT NULL,
	`build_number` text,
	`channel` text DEFAULT 'latest' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`force_update` integer DEFAULT false NOT NULL,
	`release_notes` text,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_versions_app_channel_version_unique` ON `app_versions` (`app_id`,`channel`,`version`);--> statement-breakpoint
CREATE INDEX `app_versions_app_status_idx` ON `app_versions` (`app_id`,`status`);--> statement-breakpoint
CREATE TABLE `apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`bundle_id` text NOT NULL,
	`default_channel` text DEFAULT 'latest' NOT NULL,
	`secret_hash` text,
	`enabled` integer DEFAULT true NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_slug_unique` ON `apps` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `apps_bundle_id_unique` ON `apps` (`bundle_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `file_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`category` text,
	`default_channel` text DEFAULT 'stable' NOT NULL,
	`secret_hash` text,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_projects_slug_unique` ON `file_projects` (`slug`);--> statement-breakpoint
CREATE INDEX `file_projects_category_idx` ON `file_projects` (`category`);--> statement-breakpoint
CREATE TABLE `file_releases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_project_id` integer NOT NULL,
	`file_version_id` integer NOT NULL,
	`channel` text DEFAULT 'stable' NOT NULL,
	`environment` text DEFAULT 'prod' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_project_id`) REFERENCES `file_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_version_id`) REFERENCES `file_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_releases_lookup_idx` ON `file_releases` (`file_project_id`,`channel`,`environment`,`active`);--> statement-breakpoint
CREATE TABLE `file_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_project_id` integer NOT NULL,
	`version` text NOT NULL,
	`version_normalized` text NOT NULL,
	`channel` text DEFAULT 'stable' NOT NULL,
	`environment` text DEFAULT 'prod' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`release_notes` text,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`bucket` text NOT NULL,
	`endpoint` text,
	`size` integer NOT NULL,
	`sha256` text,
	`mime_type` text,
	`visibility` text DEFAULT 'signed' NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`created_by` integer,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_project_id`) REFERENCES `file_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_versions_project_target_version_unique` ON `file_versions` (`file_project_id`,`channel`,`environment`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `file_versions_object_key_unique` ON `file_versions` (`object_key`);--> statement-breakpoint
CREATE INDEX `file_versions_project_status_idx` ON `file_versions` (`file_project_id`,`status`);--> statement-breakpoint
CREATE TABLE `releases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`version_id` integer NOT NULL,
	`channel` text DEFAULT 'latest' NOT NULL,
	`platform` text NOT NULL,
	`arch` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `app_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `releases_lookup_idx` ON `releases` (`app_id`,`channel`,`platform`,`arch`,`active`);--> statement-breakpoint
CREATE TABLE `update_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`version_id` integer NOT NULL,
	`platform` text NOT NULL,
	`arch` text NOT NULL,
	`package_type` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`bucket` text NOT NULL,
	`endpoint` text,
	`size` integer NOT NULL,
	`sha256` text,
	`sha512` text,
	`mime_type` text,
	`download_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `app_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `update_files_version_idx` ON `update_files` (`version_id`);--> statement-breakpoint
CREATE INDEX `update_files_target_idx` ON `update_files` (`app_id`,`platform`,`arch`,`package_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `update_files_object_key_unique` ON `update_files` (`object_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);