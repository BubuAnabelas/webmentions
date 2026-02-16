import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../migrations');

function loadDefaultSchemaSql(): string {
	const sqlFiles = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort();
	return sqlFiles
		.map((f) =>
			readFileSync(join(MIGRATIONS_DIR, f), 'utf8').replace(/--> statement-breakpoint\n?/g, '')
		)
		.join('\n')
		.trim();
}

const DEFAULT_SCHEMA_SQL = loadDefaultSchemaSql();

const D1_BINDING_NAME = 'DB';
const D1_DATABASE_ID = 'integration-test-db';

/**
 * Creates a Miniflare instance with a D1 binding and applies the schema.
 * Returns the Miniflare instance and the D1 database for use in integration tests.
 * Caller must call `mf.dispose()` when done (e.g. in afterAll).
 */
export async function createMiniflareWithD1(schemaSql: string = DEFAULT_SCHEMA_SQL): Promise<{
	mf: Miniflare;
	db: D1Database;
}> {
	const mf = new Miniflare({
		script: `export default { fetch() { return new Response(null, { status: 204 }); } }`,
		d1Databases: { [D1_BINDING_NAME]: D1_DATABASE_ID },
		modules: true,
	});

	const db = await mf.getD1Database(D1_BINDING_NAME);
	await db.exec(schemaSql);

	return { mf, db };
}
