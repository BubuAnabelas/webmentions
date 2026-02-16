import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { webmentionRoutes } from './webmention';
import type { ErrorResponse, WebMentionResponse } from '../types';
import { WebMentionResponseSchema } from '../types';
import { createD1CompatFromSqlite } from '../test-helpers/d1-sqlite-compat';
import { createTestExecutionContext } from '../test-helpers/execution-context';

type PendingMentionRow = { id: number; source: string; target: string; processed: number };

describe('WebMention E2E Compliance', () => {
	let db: D1Database;
	let close: () => void;
	let env: { DB: D1Database };

	beforeEach(() => {
		const setup = createD1CompatFromSqlite();
		db = setup.db;
		close = setup.close;
		env = { DB: db };
	});

	afterEach(() => {
		close();
	});

	// Spec 3.2.1 Request Verification
	describe('3.2.1 Request Verification', () => {
		it('MUST check that source and target are valid URLs', async () => {
			const invalidInputs = [
				{ source: 'not-a-url', target: 'https://localhost/valid' },
				{ source: 'https://example.com/valid', target: 'not-a-url' },
				{ source: 'not-a-url', target: 'not-a-url' },
			];

			for (const input of invalidInputs) {
				const request = new Request('http://localhost/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(input),
				});

				const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
				expect(response.status).toBeGreaterThanOrEqual(400);
				expect(response.status).toBeLessThan(500);
			}
		});

		it('MUST check that source and target are of schemes supported by the receiver (https in this config)', async () => {
			// The current implementation is configured with requiredProtocol: 'https'
			// So http, ftp, mailto, etc should all fail.
			const unsupportedSchemes = [
				{ source: 'http://example.com/valid', target: 'https://localhost/valid' },
				{ source: 'https://example.com/valid', target: 'http://localhost/valid' },
				{ source: 'ftp://example.com/file', target: 'https://localhost/valid' },
				{ source: 'https://example.com/valid', target: 'ftp://localhost/valid' },
				{ source: 'mailto:user@example.com', target: 'https://localhost/valid' },
			];

			for (const input of unsupportedSchemes) {
				const request = new Request('http://localhost/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(input),
				});

				const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
				expect(response.status).toBe(400);
			}
		});

		it('MUST reject the request if the source URL is the same as the target URL', async () => {
			const sameUrls = [
				{ source: 'https://localhost/post', target: 'https://localhost/post' },
				{ source: 'https://localhost/post/', target: 'https://localhost/post/' },
			];

			for (const input of sameUrls) {
				const request = new Request('http://localhost/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(input),
				});

				const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
				expect(response.status).toBe(400);
				const body = (await response.json()) as ErrorResponse;
				// Checking for the specific error message logic (even if the message text is currently buggy in the library)
				expect(body.error).toBe('The target URL must be the same as the source URL');
			}
		});

		it('SHOULD check that target is a valid resource for which it can accept Webmentions', async () => {
			// In our case, valid resource means "host is in supportedHosts" (localhost)
			const input = { source: 'https://example.com/post', target: 'https://other-domain.com/post' };

			const request = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input),
			});

			const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
			expect(response.status).toBe(400);
			const body = (await response.json()) as ErrorResponse;
			expect(body.error).toBe('Unsupported Target');
		});
	});

	// Spec 3.2 Receiving Webmentions
	describe('3.2 Receiving Webmentions', () => {
		it('MUST respond with 201 Created or 202 Accepted on success', async () => {
			const input = { source: 'https://example.com/post', target: 'https://localhost/post' };

			const request = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input),
			});

			const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
			expect([201, 202]).toContain(response.status);

			const body = (await response.json()) as WebMentionResponse;
			
			// Verify response matches schema
			const schemaResult = WebMentionResponseSchema.safeParse(body);
			expect(schemaResult.success).toBe(true);
			
			expect(body.success).toBe(true);

			// Verify DB insertion
			const { results } = await db.prepare('SELECT * FROM pendingMentions').all<PendingMentionRow>();
			expect(results.length).toBe(1);
			expect(results[0].source).toBe('https://example.com/post');
			expect(results[0].target).toBe('https://localhost/post');
			expect(results[0].processed).toBe(0);
		});

		it('queuing should allow multiple submissions (idempotency handled in processing)', async () => {
			// The endpoint accepts duplicate requests (returns 201/202).
			// The spec says "Processing" should be idempotent.
			// Here we verify the endpoint behaves correctly (accepts both).
			const input = { source: 'https://example.com/post', target: 'https://localhost/post' };

			const req1 = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input),
			});
			const res1 = await webmentionRoutes.fetch(req1, env, createTestExecutionContext());
			expect([201, 202]).toContain(res1.status);

			const req2 = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input),
			});
			const res2 = await webmentionRoutes.fetch(req2, env, createTestExecutionContext());
			expect([201, 202]).toContain(res2.status);

			// Check database state - currently implementation queues both
			const { results } = await db.prepare('SELECT * FROM pendingMentions').all<PendingMentionRow>();
			expect(results.length).toBe(2);
		});
	});

    // webmention.rocks specific tests
    describe('webmention.rocks Receiver Tests', () => {
        it('Receiver Test #1 - Accepts valid Webmention request', async () => {
            const input = {
                source: 'https://webmention.rocks/test/1',
                target: 'https://localhost/test/1'
            };
            const request = new Request('http://localhost/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            });
            const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
            expect([201, 202]).toContain(response.status);
        });

        it('Receiver Test #2 - Validates source and target URLs (rejection)', async () => {
             const invalidInputs = [
                { source: 'javascript:alert(1)', target: 'https://localhost/valid' },
                { source: 'https://example.com', target: 'javascript:alert(1)' },
             ];
             for (const input of invalidInputs) {
                const request = new Request('http://localhost/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(input),
                });
                const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
                expect(response.status).toBe(400);
             }
        });
    });

	describe('Blocklist', () => {
		it('accepts webmention when source does not match any block rule', async () => {
			await db.exec(
				`INSERT INTO block_rules (domain_pattern, pattern_kind, created_at) VALUES ('evil.com', 'exact', ${Math.floor(Date.now() / 1000)})`
			);
			const request = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: 'https://good.com/post',
					target: 'https://localhost/post',
				}),
			});
			const response = await webmentionRoutes.fetch(request, env, createTestExecutionContext());
			expect([201, 202]).toContain(response.status);
		});
	});
});
