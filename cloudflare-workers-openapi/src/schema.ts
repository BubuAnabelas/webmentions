import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { mentions, pendingMentions } from 'webmentions-handler-drizzle';

export { mentions, pendingMentions };

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

/** Site settings (e.g. webmention_mode). Admin chooses per site via dashboard. */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
});

/** Block rules: domain pattern, source URL prefix, or mention type. At least one of domainPattern, sourceUrlPrefix, or mentionType is set. */
export const blockRules = sqliteTable('block_rules', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	/** e.g. "evil.com", "*.spam.com", "spam.*" */
	domainPattern: text('domain_pattern'),
	/** 'exact' | 'suffix' (e.g. *.evil.com) | 'prefix' (e.g. spam.*) */
	patternKind: text('pattern_kind', { enum: ['exact', 'suffix', 'prefix'] }),
	/** Block source URLs starting with this (e.g. https://example.com/user/bob/) */
	sourceUrlPrefix: text('source_url_prefix'),
	/** IndieWeb mention type: in-reply-to, like-of, repost-of, mention-of, bookmark-of, rsvp. Applied when processing (type known after fetch). */
	mentionType: text('mention_type'),
	/** Optional label: Spam, Malicious, Blocked user, etc. */
	label: text('label'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});