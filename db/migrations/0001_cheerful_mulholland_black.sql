CREATE TABLE `storage_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`provider` text DEFAULT 'aliyun_oss' NOT NULL,
	`region` text NOT NULL,
	`access_key_id` text NOT NULL,
	`access_key_secret` text NOT NULL,
	`bucket` text NOT NULL,
	`endpoint` text,
	`public_base_url` text,
	`upload_dir` text DEFAULT 'electron-updates' NOT NULL,
	`file_release_dir` text DEFAULT 'files' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`verified_at` text,
	`last_verify_status` text,
	`last_verify_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_configs_name_unique` ON `storage_configs` (`name`);--> statement-breakpoint
CREATE INDEX `storage_configs_provider_verified_idx` ON `storage_configs` (`provider`,`enabled`,`verified`);--> statement-breakpoint
ALTER TABLE `update_files` ADD `storage_config_id` integer REFERENCES storage_configs(id);