import { describe, it, expect } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { webmentionRoutes } from './webmention';
import type { Env } from '../index';
import type { ErrorResponse, WebMentionResponse } from '../types';
import {
	WebMentionResponseSchema,
	ErrorResponseSchema,
} from '../types';
import { domains, settings } from '../schema';
import {
	createD1CompatFromSqlite,
	createFailingD1Compat,
	createThrowingD1Compat,
} from '../test-helpers/d1-sqlite-compat';
import { createTestExecutionContext } from '../test-helpers/execution-context';

describe('webmention endpoint', () => {
	it('returns 201 and recommended response when source and target are valid (target host localhost, both https)', async () => {
		const { db, close } = createD1CompatFromSqlite();
		try {
			const env: Env = { DB: db };
			const request = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: 'https://example.com/post1',
					target: 'https://localhost/target1',
				}),
			});

			const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
			expect([201, 202]).toContain(response.status);
			const body = (await response.json()) as WebMentionResponse;
			const schemaResult = WebMentionResponseSchema.safeParse(body);
			expect(schemaResult.success).toBe(true);
			expect(body.success).toBe(true);
		} finally {
			close();
		}
	});

	it('returns 400 or 422 for invalid source URL', async () => {
		const { db, close } = createD1CompatFromSqlite();
		try {
			const env: Env = { DB: db };
			const request = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: 'not-a-url',
					target: 'https://localhost/target1',
				}),
			});

			const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
			expect([400, 422]).toContain(response.status);
			const body = (await response.json()) as ErrorResponse | { message?: string; details?: ErrorResponse['details'] };
			// Note: Not validating schema here because response can be 400 or 422 with different formats
			expect('error' in body ? body.error : body.message ?? (Array.isArray(body.details) && body.details.length > 0)).toBeTruthy();
		} finally {
			close();
		}
	});

	it('returns 400 or 422 when target is missing', async () => {
		const { db, close } = createD1CompatFromSqlite();
		try {
			const env: Env = { DB: db };
			const request = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: 'https://example.com/post1',
				}),
			});

			const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
			expect([400, 422]).toContain(response.status);
			const text = await response.text();
			expect(text).toBeTruthy();
		} finally {
			close();
		}
	});

	it('returns 400 with "Unsupported Target" when target host is not localhost', async () => {
		const { db, close } = createD1CompatFromSqlite();
		try {
			const env: Env = { DB: db };
			const request = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: 'https://example.com/post1',
					target: 'https://example.org/target1',
				}),
			});

			const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
			expect(response.status).toBe(400);
			const body = (await response.json()) as ErrorResponse;
			
			// Verify response matches schema
			const schemaResult = ErrorResponseSchema.safeParse(body);
			expect(schemaResult.success).toBe(true);
			
			expect(body.error).toBe('Unsupported Target');
		} finally {
			close();
		}
	});

	it('returns 400 when target does not use https', async () => {
		const { db, close } = createD1CompatFromSqlite();
		try {
			const env: Env = { DB: db };
			const request = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: 'https://example.com/post1',
					target: 'http://localhost/target1',
				}),
			});

			const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
			expect(response.status).toBe(400);
			const body = (await response.json()) as ErrorResponse;
			
			// Verify response matches schema
			const schemaResult = ErrorResponseSchema.safeParse(body);
			expect(schemaResult.success).toBe(true);
			
			expect(body.error).toContain('https');
		} finally {
			close();
		}
	});

	it('returns 400 when DB/storage throws', async () => {
		const { db } = createFailingD1Compat();
		const env: Env = { DB: db };
		const request = new Request('http://localhost/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				source: 'https://example.com/post1',
				target: 'https://localhost/target1',
			}),
		});

		const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
		expect(response.status).toBe(400);
		const body = (await response.json()) as ErrorResponse;
		
		// Verify response matches schema
		const schemaResult = ErrorResponseSchema.safeParse(body);
		expect(schemaResult.success).toBe(true);
		
		expect(body.error).toBe('D1 failure');
	});

	it('returns 400 and stringifies when handler throws a non-Error', async () => {
		const { db } = createThrowingD1Compat('non-Error value');
		const env: Env = { DB: db };
		const request = new Request('http://localhost/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				source: 'https://example.com/post1',
				target: 'https://localhost/target1',
			}),
		});

		const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
		expect(response.status).toBe(400);
		const body = (await response.json()) as ErrorResponse;
		
		// Verify response matches schema
		const schemaResult = ErrorResponseSchema.safeParse(body);
		expect(schemaResult.success).toBe(true);
		
		expect(body.error).toBe('non-Error value');
	});

	describe('WEBMENTION_MODE', () => {
		it('admit_all accepts webmention from any source (default)', async () => {
			const { db, close } = createD1CompatFromSqlite();
			try {
				const env: Env = { DB: db };
				const request = new Request('http://localhost/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						source: 'https://unknown-source.com/post',
						target: 'https://localhost/target1',
					}),
				});
				const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
				expect([201, 202]).toContain(response.status);
			} finally {
				close();
			}
		});

		it('admit_all accepts webmention when mode is admit_all', async () => {
			const { db, close } = createD1CompatFromSqlite();
			try {
				await drizzle(db).insert(settings).values({ key: 'webmention_mode', value: 'admit_all' });
				const env: Env = { DB: db };
				const request = new Request('http://localhost/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						source: 'https://example.com/post1',
						target: 'https://localhost/target1',
					}),
				});
				const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
				expect([201, 202]).toContain(response.status);
			} finally {
				close();
			}
		});

		it('whitelist_only rejects when source domain not on whitelist', async () => {
			const { db, close } = createD1CompatFromSqlite();
			try {
				await drizzle(db).insert(settings).values({ key: 'webmention_mode', value: 'whitelist_only' });
				const env: Env = { DB: db };
				const request = new Request('http://localhost/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						source: 'https://example.com/post1',
						target: 'https://localhost/target1',
					}),
				});
				const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
				expect(response.status).toBe(400);
				const body = (await response.json()) as ErrorResponse;
				expect(body.error).toBe('Source domain not on whitelist');
			} finally {
				close();
			}
		});

		it('whitelist_only accepts when source domain is verified whitelist', async () => {
			const { db, close } = createD1CompatFromSqlite();
			try {
				await drizzle(db).insert(settings).values({ key: 'webmention_mode', value: 'whitelist_only' });
				await drizzle(db).insert(domains).values({
					domain: 'example.com',
					listType: 'whitelist',
					verificationToken: 'token',
					verified: true,
					createdAt: new Date(),
				});
				const env: Env = { DB: db };
				const request = new Request('http://localhost/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						source: 'https://example.com/post1',
						target: 'https://example.com/target1',
					}),
				});
				const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
				expect([201, 202]).toContain(response.status);
			} finally {
				close();
			}
		});

		it('whitelist_only rejects when source domain is not in verified whitelist', async () => {
			const { db, close } = createD1CompatFromSqlite();
			try {
				await drizzle(db).insert(settings).values({ key: 'webmention_mode', value: 'whitelist_only' });
				await drizzle(db).insert(domains).values({
					domain: 'example.com',
					listType: 'whitelist',
					verificationToken: 'token',
					verified: true,
					createdAt: new Date(),
				});
				const env: Env = { DB: db };
				const request = new Request('http://localhost/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						source: 'https://other.com/post1',
						target: 'https://example.com/target1',
					}),
				});
				const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
				expect(response.status).toBe(400);
				const body = (await response.json()) as ErrorResponse;
				expect(body.error).toBe('Source domain not on whitelist');
			} finally {
				close();
			}
		});

		it('whitelist_only accepts when source is on whitelist but not verified', async () => {
			const { db, close } = createD1CompatFromSqlite();
			try {
				await drizzle(db).insert(settings).values({ key: 'webmention_mode', value: 'whitelist_only' });
				const now = new Date();
				await drizzle(db).insert(domains).values({
					domain: 'example.com',
					listType: 'whitelist',
					verificationToken: 'token1',
					verified: true,
					createdAt: now,
				});
				await drizzle(db).insert(domains).values({
					domain: 'sender.com',
					listType: 'whitelist',
					verificationToken: 'token2',
					verified: false,
					createdAt: now,
				});
				const env: Env = { DB: db };
				const request = new Request('http://localhost/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						source: 'https://sender.com/post1',
						target: 'https://example.com/target1',
					}),
				});
				const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
				expect([201, 202]).toContain(response.status);
			} finally {
				close();
			}
		});
	});
});
