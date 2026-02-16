import { OpenAPIHono } from '@hono/zod-openapi';
import {
	DrizzleWebMentionStorage,
	type AnyDrizzleDb,
} from 'webmentions-handler-drizzle';
import { WebMentionHandler, type WebMentionOptions } from 'webmention-handler';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { mentions, pendingMentions, domains, blockRules, settings } from '../schema';
import {
	WebMentionRequestSchema,
	WebMentionResponseSchema,
	ErrorResponseSchema,
} from '../types';
import { blockRuleMatchesSource } from '../lib/block-rules';
import type { Env } from '../index';

function hostFromUrl(url: string): string | null {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}

function normalizeHost(host: string): string {
	return host.toLowerCase().replace(/^www\./, '');
}

const webmentionRoutes = new OpenAPIHono<{ Bindings: Env }>();

const webmentionRequestSchema = WebMentionRequestSchema;
const webmentionResponseSchema = WebMentionResponseSchema;
const errorResponseSchema = ErrorResponseSchema;

webmentionRoutes.openapi(
	{
		method: 'post',
		path: '/',
		summary: 'Create a new WebMention',
		description: 'Submit a webmention with source and target URLs',
		request: {
			body: {
				content: {
					'application/json': {
						schema: webmentionRequestSchema,
					},
				},
			},
		},
		responses: {
			201: {
				description: 'WebMention created successfully',
				content: {
					'application/json': {
						schema: webmentionResponseSchema,
					},
				},
			},
			202: {
				description: 'WebMention accepted (queued for processing)',
				content: {
					'application/json': {
						schema: webmentionResponseSchema,
					},
				},
			},
			400: {
				description: 'Invalid webmention request',
				content: {
					'application/json': {
						schema: errorResponseSchema,
					},
				},
			},
		},
	},
	async (c) => {
		try {
			const { source, target } = c.req.valid('json');

			const db = drizzle(c.env.DB);
			let supportedHosts: string[] = ['localhost'];

			try {
				const sourceHost = hostFromUrl(source);
				if (sourceHost) {
					const blacklisted = await db
						.select()
						.from(domains)
						.where(
							and(
								eq(domains.listType, 'blacklist'),
								eq(domains.domain, sourceHost)
							)
						)
						.limit(1);
					if (blacklisted.length > 0) {
						const errorBody = errorResponseSchema.parse({
							error: 'Source domain is blacklisted',
						});
						return c.json(errorBody, 400);
					}
				}

				const rules = await db.select().from(blockRules);
				for (const rule of rules) {
					if (blockRuleMatchesSource(rule, source)) {
						const errorBody = errorResponseSchema.parse({
							error: rule.label
								? `Blocked: ${rule.label}`
								: 'Source matched a block rule',
						});
						return c.json(errorBody, 400);
					}
				}

				const whitelistRows = await db
					.select({ domain: domains.domain })
					.from(domains)
					.where(
						and(
							eq(domains.listType, 'whitelist'),
							eq(domains.verified, true)
						)
					);
				const fromDb = whitelistRows.map((r) => r.domain);
				if (fromDb.length > 0) {
					supportedHosts = fromDb;
				}

				const modeRow = await db
					.select({ value: settings.value })
					.from(settings)
					.where(eq(settings.key, 'webmention_mode'))
					.limit(1);
				const mode = (modeRow[0]?.value === 'whitelist_only' ? 'whitelist_only' : 'admit_all') as 'admit_all' | 'whitelist_only';
				if (mode === 'whitelist_only') {
					const whitelistAllRows = await db
						.select({ domain: domains.domain })
						.from(domains)
						.where(eq(domains.listType, 'whitelist'));
					const allowedSet = new Set(
						whitelistAllRows.map((r) => normalizeHost(r.domain))
					);
					const sourceNormalized = sourceHost ? normalizeHost(sourceHost) : '';
					if (!sourceNormalized || !allowedSet.has(sourceNormalized)) {
						const errorBody = errorResponseSchema.parse({
							error: 'Source domain not on whitelist',
						});
						return c.json(errorBody, 400);
					}
				}
			} catch {
				// Domains table missing or query failed; use default localhost
			}

			const storageHandler = new DrizzleWebMentionStorage(
				db as AnyDrizzleDb,
				mentions,
				pendingMentions
			);

			const options: WebMentionOptions = {
				supportedHosts,
				storageHandler,
				requiredProtocol: 'https',
			};

			const webMentionHandler = new WebMentionHandler(options);
			const recommendedResponse = await webMentionHandler.addPendingMention(
				source,
				target
			);

			const successBody = webmentionResponseSchema.parse({ success: true });
			const status = recommendedResponse.code as 201 | 202;
			const res = c.json(successBody, status);
			if (recommendedResponse.headers && Object.keys(recommendedResponse.headers).length > 0) {
				const headers = new Headers(res.headers);
				for (const [name, value] of Object.entries(recommendedResponse.headers)) {
					headers.set(name, value);
				}
				return new Response(res.body, { status, headers }) as any;
			}
			return res;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorBody = errorResponseSchema.parse({ error: errorMessage });
			return c.json(errorBody, 400);
		}
	}
);

export { webmentionRoutes };
