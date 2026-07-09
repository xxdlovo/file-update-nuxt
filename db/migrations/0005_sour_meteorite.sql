CREATE TABLE `app_update_check_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`app_version_id` integer,
	`channel` text NOT NULL,
	`platform` text NOT NULL,
	`arch` text NOT NULL,
	`current_version` text,
	`update_available` integer DEFAULT false NOT NULL,
	`files_issued` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'api' NOT NULL,
	`user_agent` text,
	`referer` text,
	`ip_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_version_id`) REFERENCES `app_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `app_update_check_events_app_created_idx` ON `app_update_check_events` (`app_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `app_update_check_events_version_created_idx` ON `app_update_check_events` (`app_version_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `app_update_check_events_target_idx` ON `app_update_check_events` (`app_id`,`channel`,`platform`,`arch`);--> statement-breakpoint
CREATE INDEX `app_update_check_events_source_idx` ON `app_update_check_events` (`source`);--> statement-breakpoint
CREATE TABLE `file_update_check_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_project_id` integer NOT NULL,
	`file_version_id` integer,
	`channel` text NOT NULL,
	`environment` text NOT NULL,
	`current_version` text,
	`update_available` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'api' NOT NULL,
	`user_agent` text,
	`referer` text,
	`ip_hash` text,
	`token_provided` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_project_id`) REFERENCES `file_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_version_id`) REFERENCES `file_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `file_update_check_events_project_created_idx` ON `file_update_check_events` (`file_project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `file_update_check_events_version_created_idx` ON `file_update_check_events` (`file_version_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `file_update_check_events_source_idx` ON `file_update_check_events` (`source`);