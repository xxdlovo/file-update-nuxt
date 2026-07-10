CREATE TABLE `file_client_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_project_id` integer NOT NULL,
	`file_version_id` integer,
	`event_type` text NOT NULL,
	`client_id` text,
	`client_name` text,
	`client_version` text,
	`platform` text,
	`arch` text,
	`channel` text DEFAULT 'stable' NOT NULL,
	`environment` text DEFAULT 'prod' NOT NULL,
	`current_version` text,
	`startup_duration_ms` integer,
	`duration_ms` integer,
	`bytes` integer,
	`metadata` text,
	`source` text DEFAULT 'client' NOT NULL,
	`user_agent` text,
	`referer` text,
	`ip_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_project_id`) REFERENCES `file_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_version_id`) REFERENCES `file_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `file_client_events_project_created_idx` ON `file_client_events` (`file_project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `file_client_events_version_created_idx` ON `file_client_events` (`file_version_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `file_client_events_type_idx` ON `file_client_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `file_client_events_client_idx` ON `file_client_events` (`client_id`);--> statement-breakpoint
CREATE INDEX `file_client_events_target_idx` ON `file_client_events` (`file_project_id`,`channel`,`environment`);--> statement-breakpoint
CREATE TABLE `app_client_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`app_version_id` integer,
	`event_type` text NOT NULL,
	`client_id` text,
	`client_name` text,
	`client_version` text,
	`platform` text,
	`arch` text,
	`channel` text DEFAULT 'latest' NOT NULL,
	`current_version` text,
	`startup_duration_ms` integer,
	`duration_ms` integer,
	`bytes` integer,
	`metadata` text,
	`source` text DEFAULT 'client' NOT NULL,
	`user_agent` text,
	`referer` text,
	`ip_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_version_id`) REFERENCES `app_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `app_client_events_app_created_idx` ON `app_client_events` (`app_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `app_client_events_version_created_idx` ON `app_client_events` (`app_version_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `app_client_events_type_idx` ON `app_client_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `app_client_events_client_idx` ON `app_client_events` (`client_id`);--> statement-breakpoint
CREATE INDEX `app_client_events_target_idx` ON `app_client_events` (`app_id`,`channel`,`platform`,`arch`);
