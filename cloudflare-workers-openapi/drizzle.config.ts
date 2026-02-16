import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/schema.ts',
	dialect: 'sqlite',
	dbCredentials: {
		wranglerConfigPath: 'wrangler.toml',
		dbName: 'webmentions',
	},
	out: './migrations',
	verbose: true,
	strict: true,
});

