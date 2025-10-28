import express from "express";
import path from "path";
import { loadConfig } from "./config";
import { Database } from "./database/db";
import { addDomainHandler } from "./http/domain/add";
import { registerUserHandler } from "./http/users/register";
import { listUsersHandler } from "./http/users/list";
import { loginHandler, tokenHandler } from "./http/users/login";

async function main() {
	const cfg = loadConfig();
	const db = new Database(cfg.databaseUrl);
	await db.connectAndPing();

	const migrationsDir = process.env.MIGRATIONS_DIR
		? process.env.MIGRATIONS_DIR
		: path.join(process.cwd(), "src", "database", "migrations");
	await db.runMigrations(migrationsDir);

	const app = express();
	app.use(express.json());
	app.set("pool", db.pool);

	app.post("/domain/add", addDomainHandler);
	app.post("/users", registerUserHandler);
	app.get("/users", listUsersHandler);
	app.post("/users/login", loginHandler);
	app.post("/users/token", tokenHandler);

	app.get("/healthz", (_req, res) => res.send("ok"));

	app.listen(cfg.port, () => {
		console.log(`server listening on :${cfg.port}`);
	});
}

main().catch((err) => {
	console.error("fatal:", err);
	process.exit(1);
});


