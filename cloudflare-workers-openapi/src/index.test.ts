import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import worker from './index';
import type { Env } from './index';
import type { NotFoundResponse, OpenApiDoc } from './types';
import { createD1CompatFromSqlite } from './test-helpers/d1-sqlite-compat';
import { createTestExecutionContext } from './test-helpers/execution-context';

function hasZodInternals(obj: unknown): boolean {
	if (obj === null || typeof obj !== 'object') return false;
	const o = obj as Record<string, unknown>;
	if ('_def' in o && 'typeName' in o) return true;
	for (const v of Object.values(o)) {
		if (hasZodInternals(v)) return true;
	}
	return false;
}

describe('app', () => {
	let env: Env;
	let closeDb: () => void;

	beforeAll(() => {
		const s = createD1CompatFromSqlite();
		env = { DB: s.db };
		closeDb = s.close;
	});

	afterAll(() => closeDb());
	it('GET /openapi.json returns OpenAPI 3.1 document', async () => {
		const res = await worker.fetch(
			new Request('http://localhost/openapi.json'),
			env,
			createTestExecutionContext()
		);
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toContain('application/json');
		const body = (await res.json()) as OpenApiDoc;
		expect(body.openapi).toBe('3.1.0');
		expect(body.info.title).toBe('WebMentions API');
		expect(body.info.version).toBe('1.0.0');
	});

	it('OpenAPI spec documents the webmention POST endpoint with schemas', async () => {
		const res = await worker.fetch(
			new Request('http://localhost/openapi.json'),
			env,
			createTestExecutionContext()
		);
		expect(res.status).toBe(200);
		const spec = (await res.json()) as Record<string, unknown>;

		// Verify paths object exists
		expect(spec.paths).toBeDefined();

		// Verify /wm path exists (webmentionRoutes mounted at /wm)
		const wm = (spec.paths as Record<string, unknown>)['/wm'] as Record<string, unknown>;
		expect(wm).toBeDefined();

		const post = wm.post as Record<string, unknown>;
		expect(post).toBeDefined();

		// Verify request body schema exists
		const reqBody = post.requestBody as Record<string, unknown>;
		expect(reqBody).toBeDefined();
		const reqContent = reqBody.content as Record<string, unknown>;
		expect(reqContent).toBeDefined();
		const reqJson = reqContent['application/json'] as Record<string, unknown>;
		expect(reqJson).toBeDefined();
		expect(reqJson.schema).toBeDefined();
		expect(hasZodInternals(reqJson.schema)).toBe(false);

		// Verify 201 response schema exists and is valid JSON Schema (no Zod internals)
		const r201 = (post.responses as Record<string, unknown>)['201'] as Record<string, unknown>;
		expect(r201).toBeDefined();
		const c201 = r201.content as Record<string, unknown>;
		const j201 = c201?.['application/json'] as Record<string, unknown>;
		expect(j201?.schema).toBeDefined();
		expect(hasZodInternals(j201?.schema)).toBe(false);

		// Verify 400 response schema exists and is valid
		const r400 = (post.responses as Record<string, unknown>)['400'] as Record<string, unknown>;
		expect(r400).toBeDefined();
		const c400 = r400.content as Record<string, unknown>;
		const j400 = c400?.['application/json'] as Record<string, unknown>;
		expect(j400?.schema).toBeDefined();
		expect(hasZodInternals(j400?.schema)).toBe(false);

		// components.schemas must be present and non-empty for Swagger UI
		const components = spec.components as Record<string, unknown> | undefined;
		const schemas = components?.schemas as Record<string, unknown> | undefined;
		expect(schemas).toBeDefined();
		expect(Object.keys(schemas!).length).toBeGreaterThan(0);
	});

	it('generates openapi.json file for verification', async () => {
		const res = await worker.fetch(
			new Request('http://localhost/openapi.json'),
			env,
			createTestExecutionContext()
		);
		expect(res.status).toBe(200);
		const doc = (await res.json()) as Record<string, unknown>;
		const outPath = join(process.cwd(), 'openapi.json');
		writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf8');
		console.log('Written openapi.json to', outPath);
	});

	it('OpenAPI spec only documents intended endpoints', async () => {
		const res = await worker.fetch(
			new Request('http://localhost/openapi.json'),
			env,
			createTestExecutionContext()
		);
		expect(res.status).toBe(200);
		const spec = await res.json() as any;

		// Get all documented paths
		const paths = Object.keys(spec.paths || {});

		// Should only have the /wm webmention endpoint
		expect(paths).toEqual(['/wm']);
	});

	it('GET /docs returns Swagger UI HTML', async () => {
		const res = await worker.fetch(
			new Request('http://localhost/docs'),
			env,
			createTestExecutionContext()
		);
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toContain('text/html');
		const text = await res.text();
		expect(text).toBeTruthy();
	});

	it('returns 404 JSON for unmatched routes', async () => {
		const res = await worker.fetch(
			new Request('http://localhost/unknown'),
			env,
			createTestExecutionContext()
		);
		expect(res.status).toBe(404);
		const body = (await res.json()) as NotFoundResponse;
		expect(body.success).toBe(false);
		expect(body.error).toBe('Route not found');
	});
});
