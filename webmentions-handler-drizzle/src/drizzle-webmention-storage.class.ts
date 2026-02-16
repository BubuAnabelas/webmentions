import { and, eq, inArray } from 'drizzle-orm';
import type {
  IWebMentionStorage,
  Mention,
  SimpleMention,
} from 'webmention-handler';

import { mentions, pendingMentions } from './schema';

type SimpleMentionStorage = SimpleMention & { readonly processed: boolean };

// Generic type for any Drizzle database instance
// This works with SQLite, D1, PostgreSQL, MySQL, etc.
type QueryBuilderWithLimit = {
  limit: (count: number) => Promise<unknown[]>;
};

type AnyDrizzleDb = {
  insert: <T extends typeof mentions | typeof pendingMentions>(
    table: T
  ) => {
    values: (values: Record<string, unknown>) => Promise<unknown>;
  };
  select: () => {
    from: <T extends typeof mentions | typeof pendingMentions>(
      table: T
    ) => {
      where: (condition: unknown) => QueryBuilderWithLimit;
    };
  };
  update: <T extends typeof mentions | typeof pendingMentions>(
    table: T
  ) => {
    set: (values: Record<string, unknown>) => {
      where: (condition: unknown) => Promise<unknown>;
    };
  };
};

export class DrizzleWebMentionStorage implements IWebMentionStorage {
  private dbEngine: AnyDrizzleDb;
  private mentionsTable: typeof mentions;
  private pendingMentionsTable: typeof pendingMentions;
  readonly maxPendingFetch = 5;
  readonly limitMentionsPerPageFetch = 50;

  constructor(
    drizzle: AnyDrizzleDb,
    mentionsTable: typeof mentions = mentions,
    pendingMentionsTable: typeof pendingMentions = pendingMentions,
  ) {
    this.dbEngine = drizzle;
    this.mentionsTable = mentionsTable;
    this.pendingMentionsTable = pendingMentionsTable;
  }

  async addPendingMention(
    mention: SimpleMention,
  ): Promise<SimpleMentionStorage> {
    await this.dbEngine
      .insert(this.pendingMentionsTable)
      .values({ ...mention, processed: false });
    return {
      source: mention.source,
      target: mention.target,
      processed: false,
    };
  }

  async getNextPendingMentions(): Promise<SimpleMention[]> {
    const mentionsList = await this.dbEngine
      .select()
      .from(this.pendingMentionsTable)
      .where(eq(this.pendingMentionsTable.processed, false))
      .limit(this.maxPendingFetch);

    const ids = (mentionsList as Array<{ id: number }>).map(
      (mention) => mention.id
    );
    if (ids.length > 0) {
      await this.dbEngine
        .update(this.pendingMentionsTable)
        .set({ processed: true })
        .where(inArray(this.pendingMentionsTable.id, ids));
    }

    return mentionsList as SimpleMention[];
  }

  async getMentionsForPage(page: string, type?: string): Promise<Mention[]> {
    const target = eq(this.mentionsTable.target, page);
    const q = type ? and(eq(this.mentionsTable.type, type), target) : target;
    return (await this.dbEngine
      .select()
      .from(this.mentionsTable)
      .where(q)
      .limit(this.limitMentionsPerPageFetch)) as Mention[];
  }

  async storeMentionForPage(_page: string, mention: Mention): Promise<Mention> {
    await this.dbEngine.insert(this.mentionsTable).values(mention);

    const storedMention = await this.dbEngine
      .select()
      .from(this.mentionsTable)
      .where(
        and(
          eq(this.mentionsTable.target, mention.target),
          eq(this.mentionsTable.source, mention.source),
        ),
      )
      .limit(1);

    if (!storedMention[0])
      throw new Error(
        `Could not find Mention after insertion, source ${mention.source} & target ${mention.target}`,
      );

    return storedMention[0] as Mention;
  }

  async deleteMention(_mention: SimpleMention): Promise<null> {
    return null;
  }
}
