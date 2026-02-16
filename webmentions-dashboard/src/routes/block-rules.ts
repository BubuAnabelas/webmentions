import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { blockRules, MENTION_TYPES } from '../schema';

type Env = { Bindings: { DB: D1Database } };

const routes = new Hono<Env>();

type CreateBody = {
	domainPattern?: string;
	patternKind?: 'exact' | 'suffix' | 'prefix';
	sourceUrlPrefix?: string;
	mentionType?: string;
	label?: string;
};

function validPatternKind(k: string): k is 'exact' | 'suffix' | 'prefix' {
	return k === 'exact' || k === 'suffix' || k === 'prefix';
}

routes.get('/api/block-rules', async (c) => {
	const db = drizzle(c.env.DB);
	const rows = await db.select().from(blockRules).orderBy(blockRules.createdAt);
	return c.json({ rules: rows });
});

routes.post('/api/block-rules', async (c) => {
	const body = (await c.req.json()) as CreateBody;
	const domainPattern = body.domainPattern?.trim() || null;
	const patternKind =
		body.patternKind && validPatternKind(body.patternKind) ? body.patternKind : null;
	const sourceUrlPrefix = body.sourceUrlPrefix?.trim() || null;
	const mentionType =
		body.mentionType && MENTION_TYPES.includes(body.mentionType as (typeof MENTION_TYPES)[number])
			? body.mentionType
			: null;
	const label = body.label?.trim() || null;

	const hasDomain = domainPattern && patternKind;
	const hasUrl = sourceUrlPrefix && sourceUrlPrefix.length > 0;
	const hasType = !!mentionType;
	if (!hasDomain && !hasUrl && !hasType) {
		return c.json(
			{
				error:
					'Provide at least one: domainPattern + patternKind (exact/suffix/prefix), sourceUrlPrefix, or mentionType',
			},
			400
		);
	}

	const db = drizzle(c.env.DB);
	await db.insert(blockRules).values({
		domainPattern: hasDomain ? domainPattern : null,
		patternKind: hasDomain ? patternKind : null,
		sourceUrlPrefix: hasUrl ? sourceUrlPrefix : null,
		mentionType: hasType ? mentionType : null,
		label,
		createdAt: new Date(),
	});
	const all = await db.select().from(blockRules).orderBy(blockRules.id);
	const inserted = all[all.length - 1];
	return c.json({ rule: inserted }, 201);
});

routes.delete('/api/block-rules/:id', async (c) => {
	const id = Number(c.req.param('id'));
	if (Number.isNaN(id)) return c.json({ error: 'Invalid id' }, 400);
	const db = drizzle(c.env.DB);
	const [existing] = await db.select().from(blockRules).where(eq(blockRules.id, id)).limit(1);
	if (!existing) return c.json({ error: 'Not found' }, 404);
	await db.delete(blockRules).where(eq(blockRules.id, id));
	return c.json({ deleted: true });
});

export { routes as blockRulesRoutes };
