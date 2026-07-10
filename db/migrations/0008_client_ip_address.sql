ALTER TABLE `file_client_events` ADD `ip_address` text;--> statement-breakpoint
ALTER TABLE `file_clients` ADD `ip_address` text;--> statement-breakpoint
ALTER TABLE `app_client_events` ADD `ip_address` text;--> statement-breakpoint
ALTER TABLE `app_clients` ADD `ip_address` text;
