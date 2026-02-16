import { describe, it, expect } from 'vitest';
import * as index from './index';
import { DrizzleWebMentionStorage } from './drizzle-webmention-storage.class';
import {
  mentions,
  pendingMentions,
  createPostgresSchema,
  createMySQLSchema,
} from './schema';

describe('index exports', () => {
  it('exports DrizzleWebMentionStorage', () => {
    expect(index.DrizzleWebMentionStorage).toBe(DrizzleWebMentionStorage);
  });

  it('exports schema items', () => {
    expect(index.mentions).toBe(mentions);
    expect(index.pendingMentions).toBe(pendingMentions);
    expect(index.createPostgresSchema).toBe(createPostgresSchema);
    expect(index.createMySQLSchema).toBe(createMySQLSchema);
  });
});
