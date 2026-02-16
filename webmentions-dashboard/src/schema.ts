import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
});

export const domains = sqliteTable('domains', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	domain: text('domain').notNull().unique(),
	listType: text('list_type', { enum: ['whitelist', 'blacklist'] })
		.notNull()
		.default('whitelist'),
	verificationToken: text('verification_token').notNull(),
	verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
	lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const blockRules = sqliteTable('block_rules', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	domainPattern: text('domain_pattern'),
	patternKind: text('pattern_kind', { enum: ['exact', 'suffix', 'prefix'] }),
	sourceUrlPrefix: text('source_url_prefix'),
	mentionType: text('mention_type'),
	label: text('label'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const MENTION_TYPES = [
	'in-reply-to',
	'like-of',
	'repost-of',
	'mention-of',
	'bookmark-of',
	'rsvp',
] as const;
