import { and, eq, inArray } from 'drizzle-orm';
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type {
	IWebMentionStorage,
	Mention,
	SimpleMention,
} from 'webmention-handler';

import { mentions, pendingMentions } from './schema';

type SimpleMentionStorage = SimpleMention & { readonly processed: boolean };

export class DrizzleWebMentionStorage implements IWebMentionStorage {
	private dbEngine: BaseSQLiteDatabase<'sync' | 'async', any, any, any>;
	readonly maxPendingFetch = 5;
	readonly limitMentionsPerPageFetch = 50;

	constructor(drizzle: BaseSQLiteDatabase<'sync' | 'async', any, any, any>) {
		this.dbEngine = drizzle;
	}

	async addPendingMention(
		mention: SimpleMention
	): Promise<SimpleMentionStorage> {
		const _result = await this.dbEngine
			.insert(pendingMentions)
			.values({ ...mention, processed: false });
		return { /*_id: result.id,*/ ...mention, ..._result, processed: false };
	}

	async getNextPendingMentions(): Promise<SimpleMention[]> {
		const mentions = await this.dbEngine
			.select()
			.from(pendingMentions)
			.where(eq(pendingMentions.processed, false))
			.limit(this.maxPendingFetch);

		const ids = mentions.map((mention: any) => mention.id);
		if (ids.length > 0) {
			await this.dbEngine
				.update(pendingMentions)
				.set({ processed: true })
				.where(inArray(pendingMentions.id, ids));
		}

		return mentions as SimpleMention[];
	}

	async getMentionsForPage(
		page: string,
		type?: string
	): Promise<Mention[]> {
		const target = eq(mentions.target, page);
		let q;
		if (type) q = and(eq(mentions.type, type), target);
		return await this.dbEngine
			.select()
			.from(mentions)
			.where(q)
			.limit(this.limitMentionsPerPageFetch) as Mention[];
	}

	async storeMentionForPage(
		_page: string,
		mention: Mention
	): Promise<Mention> {
		await this.dbEngine
			.insert(mentions)
			.values(mention);

		const storedMention = await this.dbEngine
			.select()
			.from(mentions)
			.where(
				and(
					eq(mentions.target, mention.target),
					eq(mentions.source, mention.source)
				)
			)
			.limit(1);

		if (!storedMention[0])
			throw new Error(
				`Could not find Mention after insertion, source ${mention.source} & target ${mention.target}`
			);

		return storedMention[0] as Mention;
	}

	async deleteMention(_mention: SimpleMention): Promise<null> {
		return null;
	}
}
