CREATE TABLE `domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain` text NOT NULL,
	`list_type` text NOT NULL DEFAULT 'whitelist',
	`verification_token` text NOT NULL,
	`verified` integer NOT NULL DEFAULT 0,
	`last_verified_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domains_domain_unique` ON `domains` (`domain`);
