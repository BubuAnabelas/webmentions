import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { webmentionRoutes } from './endpoints/webmention';

export interface Env {
	readonly DB: D1Database;
}

const app = new OpenAPIHono<{ Bindings: Env }>();

app.route('/wm', webmentionRoutes);

// Serve OpenAPI JSON spec
app.get('/openapi.json', (c) => {
	return c.json(
		app.getOpenAPI31Document({
			openapi: '3.1.0',
			info: {
				title: 'WebMentions API',
				version: '1.0.0',
				description: 'API for handling webmentions using Cloudflare Workers and D1',
			},
		})
	);
});

// Serve Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.notFound((c) => {
	return c.json(
		{
			success: false,
			error: 'Route not found',
		},
		404
	);
});

export default {
	fetch: app.fetch,
};
