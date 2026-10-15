ALTER TABLE `auth_users` ADD `role` text DEFAULT 'customer' NOT NULL;
--> statement-breakpoint
ALTER TABLE `auth_users` ADD `status` text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE `auth_users` ADD `locked_at` text;
--> statement-breakpoint
ALTER TABLE `auth_users` ADD `locked_reason` text;
--> statement-breakpoint
ALTER TABLE `withdrawals` ADD `processed_by` text DEFAULT '' NOT NULL;
