import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import {
  pgTable,
  varchar,
  serial,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import {
  mysqlTable,
  varchar as mysqlVarchar,
  int,
  timestamp as mysqlTimestamp,
  boolean as mysqlBoolean,
} from 'drizzle-orm/mysql-core';

// SQLite/D1 Schema
export const mentions = sqliteTable('mentions', {
  id: integer('id').primaryKey(),
  source: text('source').notNull(),
  target: text('target').notNull(),
  type: text('type'),
  parsed: integer('parsed', { mode: 'timestamp' }),
});

export const pendingMentions = sqliteTable('pendingMentions', {
  id: integer('id').primaryKey(),
  source: text('source').notNull(),
  target: text('target').notNull(),
  processed: integer('processed', { mode: 'boolean' }).notNull(),
});

// PostgreSQL Schema Factory
export function createPostgresSchema() {
  const mentionsPg = pgTable('mentions', {
    id: serial('id').primaryKey(),
    source: varchar('source', { length: 2048 }).notNull(),
    target: varchar('target', { length: 2048 }).notNull(),
    type: varchar('type', { length: 50 }),
    parsed: timestamp('parsed'),
  });

  const pendingMentionsPg = pgTable('pendingMentions', {
    id: serial('id').primaryKey(),
    source: varchar('source', { length: 2048 }).notNull(),
    target: varchar('target', { length: 2048 }).notNull(),
    processed: boolean('processed').notNull(),
  });

  return {
    mentions: mentionsPg,
    pendingMentions: pendingMentionsPg,
  };
}

// MySQL Schema Factory
export function createMySQLSchema() {
  const mentionsMySQL = mysqlTable('mentions', {
    id: int('id').primaryKey().autoincrement(),
    source: mysqlVarchar('source', { length: 2048 }).notNull(),
    target: mysqlVarchar('target', { length: 2048 }).notNull(),
    type: mysqlVarchar('type', { length: 50 }),
    parsed: mysqlTimestamp('parsed'),
  });

  const pendingMentionsMySQL = mysqlTable('pendingMentions', {
    id: int('id').primaryKey().autoincrement(),
    source: mysqlVarchar('source', { length: 2048 }).notNull(),
    target: mysqlVarchar('target', { length: 2048 }).notNull(),
    processed: mysqlBoolean('processed').notNull(),
  });

  return {
    mentions: mentionsMySQL,
    pendingMentions: pendingMentionsMySQL,
  };
}

// Default export for SQLite/D1 (backward compatibility)
export default {
  mentions,
  pendingMentions,
};
