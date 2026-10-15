CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`tracking_id` text NOT NULL,
	`bank` text DEFAULT '' NOT NULL,
	`bank_number` text DEFAULT '' NOT NULL,
	`bank_name` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_tracking_id_unique` ON `accounts` (`tracking_id`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`scope` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`original_url` text NOT NULL,
	`affiliate_url` text NOT NULL,
	`tracking_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_tracking_id_unique` ON `links` (`tracking_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`external_key` text NOT NULL,
	`external_id` text NOT NULL,
	`account_id` text NOT NULL,
	`tracking_id` text NOT NULL,
	`product` text NOT NULL,
	`amount` integer NOT NULL,
	`commission` integer NOT NULL,
	`cashback` integer NOT NULL,
	`share_bps` integer NOT NULL,
	`status` text NOT NULL,
	`settlement_ref` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_external_key_unique` ON `orders` (`external_key`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`share_bps` integer DEFAULT 8000 NOT NULL,
	`min_withdraw` integer DEFAULT 50000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `withdrawals` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`account_id` text NOT NULL,
	`amount` integer NOT NULL,
	`bank` text NOT NULL,
	`bank_number` text NOT NULL,
	`bank_name` text NOT NULL,
	`status` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `withdrawals_request_key_unique` ON `withdrawals` (`request_key`);