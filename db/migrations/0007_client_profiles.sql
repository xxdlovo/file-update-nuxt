CREATE TABLE `file_clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_project_id` integer NOT NULL,
	`file_version_id` integer,
	`client_id` text NOT NULL,
	`client_name` text,
	`client_version` text,
	`platform` text,
	`arch` text,
	`channel` text DEFAULT 'stable' NOT NULL,
	`environment` text DEFAULT 'prod' NOT NULL,
	`current_version` text,
	`last_event_type` text,
	`event_count` integer DEFAULT 0 NOT NULL,
	`startup_count` integer DEFAULT 0 NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`total_bytes` integer DEFAULT 0 NOT NULL,
	`total_startup_duration_ms` integer DEFAULT 0 NOT NULL,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`user_agent` text,
	`ip_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_project_id`) REFERENCES `file_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_version_id`) REFERENCES `file_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_clients_project_client_unique` ON `file_clients` (`file_project_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `file_clients_project_last_seen_idx` ON `file_clients` (`file_project_id`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `file_clients_version_idx` ON `file_clients` (`file_version_id`);--> statement-breakpoint
CREATE INDEX `file_clients_target_idx` ON `file_clients` (`file_project_id`,`channel`,`environment`);--> statement-breakpoint
CREATE TABLE `app_clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`app_version_id` integer,
	`client_id` text NOT NULL,
	`client_name` text,
	`client_version` text,
	`platform` text,
	`arch` text,
	`channel` text DEFAULT 'latest' NOT NULL,
	`current_version` text,
	`last_event_type` text,
	`event_count` integer DEFAULT 0 NOT NULL,
	`startup_count` integer DEFAULT 0 NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`total_bytes` integer DEFAULT 0 NOT NULL,
	`total_startup_duration_ms` integer DEFAULT 0 NOT NULL,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`user_agent` text,
	`ip_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_version_id`) REFERENCES `app_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_clients_app_client_unique` ON `app_clients` (`app_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `app_clients_app_last_seen_idx` ON `app_clients` (`app_id`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `app_clients_version_idx` ON `app_clients` (`app_version_id`);--> statement-breakpoint
CREATE INDEX `app_clients_target_idx` ON `app_clients` (`app_id`,`channel`,`platform`,`arch`);
