import fs from "fs";
import path from "path";
import { Pool } from "pg";

export class Database {
	readonly pool: Pool;

	constructor(dsn: string) {
		this.pool = new Pool({ connectionString: dsn });
	}

	async connectAndPing(): Promise<void> {
		const client = await this.pool.connect();
		try {
			await client.query("SELECT 1");
		} finally {
			client.release();
		}
	}

	async close(): Promise<void> {
		await this.pool.end();
	}

	async runMigrations(migrationsDir: string): Promise<void> {
		if (!migrationsDir || !migrationsDir.trim()) {
			throw new Error("migrationsDir is empty");
		}
		await this.ensureMigrationsTable();

		let entries: string[] = [];
		try {
			entries = fs.readdirSync(migrationsDir)
				.filter((f) => f.toLowerCase().endsWith(".sql"))
				.sort();
		} catch (e: any) {
			if (e && e.code === "ENOENT") return; // no dir -> nothing to do
			throw e;
		}

		const applied = await this.getAppliedMigrations();
		for (const file of entries) {
			if (applied.has(file)) continue;
			const full = path.join(migrationsDir, file);
			const sql = fs.readFileSync(full, "utf8");
			await this.applyMigration(file, sql);
		}
	}

	private async ensureMigrationsTable(): Promise<void> {
		await this.pool.query(`
CREATE TABLE IF NOT EXISTS schema_migrations (
	filename TEXT PRIMARY KEY,
	applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
	}

	private async getAppliedMigrations(): Promise<Set<string>> {
		const res = await this.pool.query<{ filename: string }>(
			"SELECT filename FROM schema_migrations"
		);
		return new Set(res.rows.map((r: { filename: string }) => r.filename));
	}

	private async applyMigration(file: string, sql: string): Promise<void> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(sql);
			await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
			await client.query("COMMIT");
		} catch (e) {
			try { await client.query("ROLLBACK"); } catch {}
			throw new Error(`apply migration ${file}: ${String(e)}`);
		} finally {
			client.release();
		}
	}
}


