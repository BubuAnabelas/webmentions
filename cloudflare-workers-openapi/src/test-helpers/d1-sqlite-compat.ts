/**
 * Minimal D1-compatible implementation for Node/Vitest using better-sqlite3.
 * Implements only the surface used by the app and tests: prepare/exec/batch on DB,
 * bind/run/all on statements. Uses @cloudflare/workers-types D1 types; cast to
 * D1Database at the boundary. Cloudflare does not ship a Node D1 impl; use
 * create-miniflare-d1.ts + getD1Database() for Miniflare’s real D1.
 */
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function d1Meta(overrides: Partial<D1Meta> = {}): D1Meta & Record<string, unknown> {
	return {
		duration: 0,
		size_after: 0,
		rows_read: 0,
		rows_written: 0,
		last_row_id: 0,
		changed_db: false,
		changes: 0,
		...overrides,
	};
}

/** Implements only bind/run/all/raw; used as Pick<D1PreparedStatement, 'bind'|'run'|'all'>. */
class Stmt implements Pick<D1PreparedStatement, 'bind' | 'run' | 'all'> {
	constructor(
		private readonly stmt: Database.Statement,
		private params: unknown[] = []
	) {}

	bind(...values: unknown[]): D1PreparedStatement {
		const out = new Stmt(this.stmt, values) as unknown as D1PreparedStatement;
		// D1's .all() has overloaded return types; our stub implements the behavior used by tests
		(out as unknown as { raw(): Promise<unknown[]> }).raw = async (): Promise<unknown[]> => {
			const rows = this.stmt.all(...values);
			const arr = Array.isArray(rows) ? rows : [];
			if (arr.length === 0) return arr;
			const columns = Object.keys(arr[0] as Record<string, unknown>);
			return arr.map((row) =>
				columns.map((col) => (row as Record<string, unknown>)[col])
			);
		};
		return out;
	}

	async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
		const info = this.stmt.run(...this.params);
		return {
			results: [],
			success: true,
			meta: d1Meta({ changes: info.changes, last_row_id: Number(info.lastInsertRowid) }),
		} as unknown as D1Result<T>;
	}

	async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
		const rows = this.stmt.all(...this.params);
		return { results: rows as T[], success: true, meta: d1Meta() } as unknown as D1Result<T>;
	}
}

/** Implements only prepare/exec/batch; used as Pick<D1Database, 'prepare'|'exec'|'batch'>. */
class Db implements Pick<D1Database, 'prepare' | 'exec' | 'batch'> {
	constructor(private readonly sqlite: Database.Database) {}

	prepare(query: string): D1PreparedStatement {
		return new Stmt(this.sqlite.prepare(query)) as unknown as D1PreparedStatement;
	}

	async exec(query: string): Promise<D1ExecResult> {
		const statements = query
			.split(';')
			.map((s) => s.trim())
			.filter(Boolean);
		for (const s of statements) {
			this.sqlite.exec(s + ';');
		}
		return { count: statements.length, duration: 0 };
	}

	async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
		const out: D1Result<T>[] = [];
		for (const s of statements) {
			out.push(await s.run<T>());
		}
		return out;
	}
}

export function createD1CompatFromSqlite(schemaSql: string = DEFAULT_SCHEMA_SQL): {
	db: D1Database;
	close: () => void;
} {
	const sqlite = new Database(':memory:');
	sqlite.exec(schemaSql);
	return {
		db: new Db(sqlite) as unknown as D1Database,
		close: () => sqlite.close(),
	};
}

/** Minimal DB that throws on run/all; only prepare/exec/batch surface. */
function throwingDb(throwFn: () => never): Pick<D1Database, 'prepare' | 'exec' | 'batch'> {
	const stmt = {
		bind(): D1PreparedStatement {
			return stmt as unknown as D1PreparedStatement;
		},
		run<T>(): Promise<D1Result<T>> {
			return Promise.resolve(throwFn());
		},
		all<T>(): Promise<D1Result<T>> {
			return Promise.resolve(throwFn());
		},
	};
	return {
		prepare() {
			return stmt as unknown as D1PreparedStatement;
		},
		async exec(): Promise<D1ExecResult> {
			return { count: 0, duration: 0 };
		},
		async batch<T = unknown>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
			return [] as D1Result<T>[];
		},
	};
}

export function createFailingD1Compat(): { db: D1Database; close: () => void } {
	return {
		db: throwingDb(() => {
			throw new Error('D1 failure');
		}) as unknown as D1Database,
		close: () => {},
	};
}

export function createThrowingD1Compat(throwValue: string): { db: D1Database; close: () => void } {
	return {
		db: throwingDb(() => {
			throw throwValue;
		}) as unknown as D1Database,
		close: () => {},
	};
}
