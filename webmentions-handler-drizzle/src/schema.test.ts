import { describe, it, expect } from 'vitest';
import { createPostgresSchema, createMySQLSchema } from './schema';

describe('schema factories', () => {
  it('createPostgresSchema returns PostgreSQL schema objects', () => {
    const schema = createPostgresSchema();

    expect(schema).toHaveProperty('mentions');
    expect(schema).toHaveProperty('pendingMentions');
    expect(schema.mentions).toBeDefined();
    expect(schema.pendingMentions).toBeDefined();
  });

  it('createMySQLSchema returns MySQL schema objects', () => {
    const schema = createMySQLSchema();

    expect(schema).toHaveProperty('mentions');
    expect(schema).toHaveProperty('pendingMentions');
    expect(schema.mentions).toBeDefined();
    expect(schema.pendingMentions).toBeDefined();
  });
});
