import { Request, Response } from "express";
import { Pool } from "pg";
import { listUsers } from "../../logic/users/list";

export async function listUsersHandler(req: Request, res: Response) {
	if (req.method !== "GET") {
		return res.status(405).send("method not allowed");
	}
	const pool = req.app.get("pool") as Pool | undefined;
	if (!pool) return res.status(500).send("database not initialized");

	const limit = Number((req.query.limit as string) || "");
	const offset = Number((req.query.offset as string) || "");
	const params = {
		limit: Number.isFinite(limit) ? limit : undefined,
		offset: Number.isFinite(offset) ? offset : undefined,
	};

	try {
		const users = await listUsers(pool, params);
		return res.json(users);
	} catch (_e) {
		return res.status(500).send("internal error");
	}
}


