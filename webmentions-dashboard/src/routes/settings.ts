import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { settings } from '../schema';

type Env = { Bindings: { DB: D1Database } };

const WEBMENTION_MODE_KEY = 'webmention_mode';
const VALID_MODES = ['admit_all', 'whitelist_only'] as const;

const routes = new Hono<Env>();

routes.get('/api/settings', async (c) => {
	const db = drizzle(c.env.DB);
	const rows = await db.select().from(settings);
	const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
	return c.json({
		webmention_mode: VALID_MODES.includes(map[WEBMENTION_MODE_KEY] as (typeof VALID_MODES)[number])
			? map[WEBMENTION_MODE_KEY]
			: 'admit_all',
	});
});

routes.patch('/api/settings', async (c) => {
	const body = await c.req.json<{ webmention_mode?: string }>();
	const mode = body.webmention_mode;
	if (mode !== undefined && !VALID_MODES.includes(mode as (typeof VALID_MODES)[number])) {
		return c.json({ error: 'webmention_mode must be admit_all or whitelist_only' }, 400);
	}
	const db = drizzle(c.env.DB);
	if (mode !== undefined) {
		const existing = await db
			.select()
			.from(settings)
			.where(eq(settings.key, WEBMENTION_MODE_KEY))
			.limit(1);
		if (existing.length > 0) {
			await db.update(settings).set({ value: mode }).where(eq(settings.key, WEBMENTION_MODE_KEY));
		} else {
			await db.insert(settings).values({ key: WEBMENTION_MODE_KEY, value: mode });
		}
	}
	const rows = await db.select().from(settings);
	const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
	return c.json({
		webmention_mode: VALID_MODES.includes(map[WEBMENTION_MODE_KEY] as (typeof VALID_MODES)[number])
			? map[WEBMENTION_MODE_KEY]
			: 'admit_all',
	});
});

export { routes as settingsRoutes };
