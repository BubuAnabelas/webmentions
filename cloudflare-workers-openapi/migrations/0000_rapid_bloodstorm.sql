CREATE TABLE `mentions` (
	`id` integer PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`target` text NOT NULL,
	`type` text,
	`parsed` integer
);
--> statement-breakpoint
CREATE TABLE `pendingMentions` (
	`id` integer PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`target` text NOT NULL,
	`processed` integer NOT NULL
);
