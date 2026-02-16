import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { domains } from '../schema';
import { fetchAndCheckToken, META_NAME, LINK_REL } from '../lib/verify';

type Env = { Bindings: { DB: D1Database } };

const routes = new Hono<Env>();

function normalizeDomain(domain: string): string {
	const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
	return d.replace(/^www\./, '');
}

routes.get('/api/domains', async (c) => {
	const listType = c.req.query('listType') as 'whitelist' | 'blacklist' | undefined;
	const db = drizzle(c.env.DB);
	const rows =
		listType === 'whitelist' || listType === 'blacklist'
			? await db
					.select()
					.from(domains)
					.where(eq(domains.listType, listType))
					.orderBy(domains.createdAt)
			: await db.select().from(domains).orderBy(domains.createdAt);
	return c.json({ domains: rows });
});

routes.post('/api/domains', async (c) => {
	const body = await c.req.json<{ domain: string; listType?: 'whitelist' | 'blacklist' }>();
	const domain = normalizeDomain(body.domain);
	if (!domain) {
		return c.json({ error: 'Invalid domain' }, 400);
	}
	const listType = body.listType ?? 'whitelist';
	const verificationToken = crypto.randomUUID();
	const db = drizzle(c.env.DB);
	try {
		await db.insert(domains).values({
			domain,
			listType,
			verificationToken,
			verified: false,
			createdAt: new Date(),
		});
		const [row] = await db.select().from(domains).where(eq(domains.domain, domain)).limit(1);
		if (!row) return c.json({ error: 'Insert failed' }, 500);
		return c.json({
			domain: row,
			instructions: {
				meta: `<meta name="${META_NAME}" content="${verificationToken}">`,
				link: `<link rel="${LINK_REL}" href="${new URL(c.req.url).origin}/verify?token=${verificationToken}">`,
			},
		}, 201);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes('UNIQUE') || msg.includes('unique')) {
			return c.json({ error: 'Domain already exists' }, 409);
		}
		throw e;
	}
});

routes.delete('/api/domains/:id', async (c) => {
	const id = Number(c.req.param('id'));
	if (Number.isNaN(id)) return c.json({ error: 'Invalid id' }, 400);
	const db = drizzle(c.env.DB);
	const [existing] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
	if (!existing) return c.json({ error: 'Not found' }, 404);
	await db.delete(domains).where(eq(domains.id, id));
	return c.json({ deleted: true });
});

routes.post('/api/domains/:id/verify', async (c) => {
	const id = Number(c.req.param('id'));
	if (Number.isNaN(id)) return c.json({ error: 'Invalid id' }, 400);
	const db = drizzle(c.env.DB);
	const [row] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
	if (!row) return c.json({ error: 'Not found' }, 404);
	if (row.listType !== 'whitelist') {
		return c.json({ error: 'Only whitelist domains are verified' }, 400);
	}
	const ok = await fetchAndCheckToken(row.domain, row.verificationToken, fetch);
	const now = new Date();
	await db
		.update(domains)
		.set({ verified: ok, lastVerifiedAt: now })
		.where(eq(domains.id, id));
	return c.json({ verified: ok, lastVerifiedAt: now.toISOString() });
});

routes.post('/api/domains/reverify', async (c) => {
	const db = drizzle(c.env.DB);
	const rows = await db
		.select()
		.from(domains)
		.where(and(eq(domains.listType, 'whitelist'), eq(domains.verified, true)));
	const results: { domain: string; verified: boolean }[] = [];
	for (const row of rows) {
		const ok = await fetchAndCheckToken(row.domain, row.verificationToken, fetch);
		await db
			.update(domains)
			.set({ verified: ok, lastVerifiedAt: new Date() })
			.where(eq(domains.id, row.id));
		results.push({ domain: row.domain, verified: ok });
	}
	return c.json({ results });
});

export { routes as domainRoutes };
