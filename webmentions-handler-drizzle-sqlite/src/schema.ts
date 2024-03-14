import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const mentions = sqliteTable('mentions', {
	id: integer('id').primaryKey(),
	source: text('source').notNull(),
	target: text('target').notNull(),
	type: text('type'),
	parsed: integer('parsed', { mode: 'timestamp' })
});

export const pendingMentions = sqliteTable('pendingMentions', {
	id: integer('id').primaryKey(),
	source: text('source').notNull(),
	target: text('target').notNull(),
	processed: integer('processed', { mode: 'boolean' }).notNull()
})