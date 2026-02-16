/**
 * Fetches /openapi.json from the worker and writes it to openapi.json for verification.
 * Run from cloudflare-workers-openapi: pnpm test -- --run scripts/generate-openapi.ts
 * (Or: pnpm exec vitest run scripts/generate-openapi)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/index';
import { createD1CompatFromSqlite } from '../src/test-helpers/d1-sqlite-compat';
import { createTestExecutionContext } from '../src/test-helpers/execution-context';

function hasZodInternals(obj: unknown): boolean {
	if (obj === null || typeof obj !== 'object') return false;
	const o = obj as Record<string, unknown>;
	if ('_def' in o && 'typeName' in o) return true;
	for (const v of Object.values(o)) {
		if (hasZodInternals(v)) return true;
	}
	return false;
}

describe('generate-openapi', () => {
	let env: Env;
	let closeDb: () => void;

	beforeAll(() => {
		const s = createD1CompatFromSqlite();
		env = { DB: s.db };
		closeDb = s.close;
	});

	afterAll(() => closeDb());

	it('generates valid openapi.json with JSON Schema (no Zod internals)', async () => {
		const res = await worker.fetch(
			new Request('http://localhost/openapi.json'),
			env,
			createTestExecutionContext()
		);
		expect(res.ok).toBe(true);
		const doc = (await res.json()) as Record<string, unknown>;

		// Write for inspection
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const outPath = join(__dirname, '..', 'openapi.json');
		writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf8');
		console.log('Written to', outPath);

		// No Zod internals in any schema
		const paths = doc.paths as Record<string, unknown>;
		const wm = paths?.['/wm'] as Record<string, unknown> | undefined;
		const post = wm?.post as Record<string, unknown> | undefined;
		const reqBody = post?.requestBody as Record<string, unknown> | undefined;
		const content = reqBody?.content as Record<string, unknown> | undefined;
		const jsonContent = content?.['application/json'] as Record<string, unknown> | undefined;
		expect(hasZodInternals(jsonContent?.schema)).toBe(false);

		const responses = post?.responses as Record<string, unknown> | undefined;
		for (const code of ['201', '400']) {
			const r = responses?.[code] as Record<string, unknown> | undefined;
			const c = r?.content as Record<string, unknown> | undefined;
			const j = c?.['application/json'] as Record<string, unknown> | undefined;
			expect(hasZodInternals(j?.schema)).toBe(false);
		}

		// components.schemas must be present and non-empty
		const components = doc.components as Record<string, unknown> | undefined;
		const schemas = components?.schemas as Record<string, unknown> | undefined;
		expect(schemas).toBeDefined();
		expect(Object.keys(schemas!).length).toBeGreaterThan(0);
	});
});
