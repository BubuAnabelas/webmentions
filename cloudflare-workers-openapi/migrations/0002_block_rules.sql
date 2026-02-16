CREATE TABLE `block_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain_pattern` text,
	`pattern_kind` text,
	`source_url_prefix` text,
	`mention_type` text,
	`label` text,
	`created_at` integer NOT NULL
);
