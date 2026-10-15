ALTER TABLE `settings` ADD `shopee_app_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD `shopee_app_secret` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD `shopee_enabled` text DEFAULT 'false' NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD `admin_user_ids` text DEFAULT '' NOT NULL;
