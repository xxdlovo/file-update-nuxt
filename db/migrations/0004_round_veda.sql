CREATE TABLE `file_download_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_project_id` integer NOT NULL,
	`file_version_id` integer NOT NULL,
	`channel` text NOT NULL,
	`environment` text NOT NULL,
	`source` text DEFAULT 'api' NOT NULL,
	`file_name` text NOT NULL,
	`user_agent` text,
	`referer` text,
	`ip_hash` text,
	`token_provided` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_project_id`) REFERENCES `file_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_version_id`) REFERENCES `file_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_download_events_project_created_idx` ON `file_download_events` (`file_project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `file_download_events_version_created_idx` ON `file_download_events` (`file_version_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `file_download_events_source_idx` ON `file_download_events` (`source`);