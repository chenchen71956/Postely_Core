import fs from "fs";
import path from "path";
import dotenv from "dotenv";

export interface AppConfig {
	port: number;
	databaseUrl: string;
}

export function loadConfig(customEnvPaths: string[] = []): AppConfig {
	loadDotEnv(customEnvPaths);
	const databaseUrl = (process.env.DATABASE_URL || "").trim();
	if (!databaseUrl) {
		throw new Error("env DATABASE_URL is required");
	}
	const port = Number(process.env.PORT || 8080);
	return { port, databaseUrl };
}

function loadDotEnv(customEnvPaths: string[] = []): void {
	const candidates = customEnvPaths.length > 0
		? customEnvPaths
		: [
			path.resolve(".env"),
			path.resolve("..", ".env"),
			path.resolve("..", "..", ".env"),
		];
	for (const p of candidates) {
		try {
			const stat = fs.statSync(p);
			if (stat.isFile()) {
				dotenv.config({ path: p, override: false });
				break;
			}
		} catch {
			/* ignore */
		}
	}
}


