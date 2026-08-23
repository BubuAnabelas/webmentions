import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  DrizzleWebMentionStorage,
  type AnyDrizzleDb,
} from './drizzle-webmention-storage.class';
import { mentions, pendingMentions } from './schema';
import type { SimpleMention, Mention } from 'webmention-handler';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);

  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mentions (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      type TEXT,
      parsed INTEGER
    );
    CREATE TABLE IF NOT EXISTS pendingMentions (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      processed INTEGER NOT NULL
    );
  `);

  return { db, sqlite };
}

describe('DrizzleWebMentionStorage', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  let sqlite: ReturnType<typeof createTestDb>['sqlite'];

  beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    sqlite = testDb.sqlite;
  });

  afterEach(() => {
    sqlite.close();
  });

  it('constructor initializes correctly', () => {
    const storage = new DrizzleWebMentionStorage(
      db as AnyDrizzleDb,
      mentions,
      pendingMentions,
    );

    expect(storage.maxPendingFetch).toBe(5);
    expect(storage.limitMentionsPerPageFetch).toBe(50);
  });

  it('addPendingMention adds a pending mention', async () => {
    const storage = new DrizzleWebMentionStorage(
      db as AnyDrizzleDb,
      mentions,
      pendingMentions,
    );

    const mention: SimpleMention = {
      source: 'https://example.com/post1',
      target: 'https://example.org/target1',
    };

    const result = await storage.addPendingMention(mention);

    expect(result.source).toBe(mention.source);
    expect(result.target).toBe(mention.target);
    expect(result.processed).toBe(false);
  });

  it('getNextPendingMentions returns and marks pending mentions as processed', async () => {
    const storage = new DrizzleWebMentionStorage(
      db as AnyDrizzleDb,
      mentions,
      pendingMentions,
    );

    // Add some pending mentions
    await storage.addPendingMention({
      source: 'https://example.com/post1',
      target: 'https://example.org/target1',
    });
    await storage.addPendingMention({
      source: 'https://example.com/post2',
      target: 'https://example.org/target2',
    });

    const result = await storage.getNextPendingMentions();

    expect(result.length).toBe(2);
    expect(result[0].source).toBe('https://example.com/post1');
    expect(result[1].source).toBe('https://example.com/post2');

    // Verify they are marked as processed
    const secondCall = await storage.getNextPendingMentions();
    expect(secondCall.length).toBe(0);
  });

  it('getMentionsForPage returns mentions for a specific page', async () => {
    const storage = new DrizzleWebMentionStorage(
      db as AnyDrizzleDb,
      mentions,
      pendingMentions,
    );

    const mention: Mention = {
      source: 'https://example.com/post1',
      target: 'https://example.org/target1',
      type: 'reply',
      parsed: new Date(),
    };

    await storage.storeMentionForPage('https://example.org/target1', mention);

    const result = await storage.getMentionsForPage(
      'https://example.org/target1',
    );

    expect(result.length).toBe(1);
    expect(result[0].source).toBe(mention.source);
    expect(result[0].target).toBe(mention.target);
  });

  it('getMentionsForPage filters by type when provided', async () => {
    const storage = new DrizzleWebMentionStorage(
      db as AnyDrizzleDb,
      mentions,
      pendingMentions,
    );

    const replyMention: Mention = {
      source: 'https://example.com/post1',
      target: 'https://example.org/target1',
      type: 'reply',
      parsed: new Date(),
    };

    const likeMention: Mention = {
      source: 'https://example.com/post2',
      target: 'https://example.org/target1',
      type: 'like',
      parsed: new Date(),
    };

    await storage.storeMentionForPage(
      'https://example.org/target1',
      replyMention,
    );
    await storage.storeMentionForPage(
      'https://example.org/target1',
      likeMention,
    );

    const replies = await storage.getMentionsForPage(
      'https://example.org/target1',
      'reply',
    );
    expect(replies.length).toBe(1);
    expect(replies[0].type).toBe('reply');

    const likes = await storage.getMentionsForPage(
      'https://example.org/target1',
      'like',
    );
    expect(likes.length).toBe(1);
    expect(likes[0].type).toBe('like');
  });

  it('storeMentionForPage stores a mention', async () => {
    const storage = new DrizzleWebMentionStorage(
      db as AnyDrizzleDb,
      mentions,
      pendingMentions,
    );

    const mention: Mention = {
      source: 'https://example.com/post1',
      target: 'https://example.org/target1',
      type: 'reply',
      parsed: new Date(),
    };

    const result = await storage.storeMentionForPage(
      'https://example.org/target1',
      mention,
    );

    expect(result.source).toBe(mention.source);
    expect(result.target).toBe(mention.target);
    expect(result.type).toBe(mention.type);
  });

  it('storeMentionForPage ignores extra microformats2 properties that collide with real columns', async () => {
    // Real-world h-entry pages often carry an HTML `id` attribute, which mf2 parsing
    // surfaces as an `id` property on the mention. That must not collide with the
    // mentions table's own integer primary key column.
    const storage = new DrizzleWebMentionStorage(
      db as AnyDrizzleDb,
      mentions,
      pendingMentions,
    );

    const mention = {
      source: 'https://example.com/post1',
      target: 'https://example.org/target1',
      type: 'rsvp',
      parsed: new Date(),
      id: 'd139t1',
      author: { type: 'h-card', name: 'Someone' },
      content: { value: 'hello' },
    } as unknown as Mention;

    const result = await storage.storeMentionForPage(
      'https://example.org/target1',
      mention,
    );

    expect(result.source).toBe(mention.source);
    expect(result.target).toBe(mention.target);
    expect(result.type).toBe(mention.type);
  });

  it('deleteMention removes the stored mention for that source/target', async () => {
    const storage = new DrizzleWebMentionStorage(
      db as AnyDrizzleDb,
      mentions,
      pendingMentions,
    );

    const mention: Mention = {
      source: 'https://example.com/post1',
      target: 'https://example.org/target1',
      type: 'reply',
      parsed: new Date(),
    };
    await storage.storeMentionForPage(mention.target, mention);

    const result = await storage.deleteMention(mention);
    expect(result).toBe(null);

    const remaining = await storage.getMentionsForPage(mention.target);
    expect(remaining.length).toBe(0);
  });

  it('deleteMention only removes mentions matching both source and target', async () => {
    const storage = new DrizzleWebMentionStorage(
      db as AnyDrizzleDb,
      mentions,
      pendingMentions,
    );

    const mention: Mention = {
      source: 'https://example.com/post1',
      target: 'https://example.org/target1',
      type: 'reply',
      parsed: new Date(),
    };
    const otherSource: Mention = {
      ...mention,
      source: 'https://example.com/other',
    };
    await storage.storeMentionForPage(mention.target, mention);
    await storage.storeMentionForPage(otherSource.target, otherSource);

    await storage.deleteMention(mention);

    const remaining = await storage.getMentionsForPage(mention.target);
    expect(remaining.length).toBe(1);
    expect(remaining[0].source).toBe(otherSource.source);
  });

  it('storeMentionForPage throws error when mention cannot be found after insertion', async () => {
    // Create a mock db that returns empty array to simulate the error case
    const mockDb = {
      insert: () => ({
        values: async () => ({ id: 1 }),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [], // Return empty array to trigger error
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: async () => ({}),
        }),
      }),
      delete: () => ({
        where: async () => ({}),
      }),
    };

    const storageWithMockDb = new DrizzleWebMentionStorage(
      mockDb as AnyDrizzleDb,
      mentions,
      pendingMentions,
    );

    const mention: Mention = {
      source: 'https://example.com/post1',
      target: 'https://example.org/target1',
      type: 'reply',
      parsed: new Date(),
    };

    await expect(
      storageWithMockDb.storeMentionForPage(
        'https://example.org/target1',
        mention,
      ),
    ).rejects.toThrow('Could not find Mention after insertion');
  });
});
