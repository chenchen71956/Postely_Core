import express from "express";
import path from "path";
import { loadConfig } from "./config";
import { Database } from "./database/db";
import { addDomainHandler } from "./http/domain/add";
import { registerUserHandler } from "./http/users/register";
import { getAllUsersHandler } from "./http/users/list";
import { getUserByUUIDHandler } from "./http/users/get";
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

	const api = express.Router();

	api.post("/domain/add", addDomainHandler);
	api.post("/auth/register", registerUserHandler);
	api.post("/auth/login", loginHandler);
	api.post("/auth/token", tokenHandler);
	api.get("/users/all", getAllUsersHandler);
	api.get("/users/:uuid", getUserByUUIDHandler);

	api.get("/healthz", (_req, res) => res.send("ok"));

	app.use("/api/v1", api);
	app.listen(cfg.port, () => {
		console.log(`server listening on :${cfg.port}`);
	});
}

main().catch((err) => {
	console.error("fatal:", err);
	process.exit(1);
});


