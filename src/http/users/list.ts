import { Request, Response } from "express";
import { Pool } from "pg";
import { listUsers } from "../../logic/users/list";
import jwt from "jsonwebtoken";

export async function listUsersHandler(req: Request, res: Response) {
	if (req.method !== "GET") {
		return res.status(405).send("method not allowed");
	}
	const pool = req.app.get("pool") as Pool | undefined;
	if (!pool) return res.status(500).send("database not initialized");

    // 短token鉴权 + 管理员校验
    const auth = req.header("authorization") || req.header("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).send("missing bearer token");
    const token = m[1];
    try {
        const payload: any = jwt.verify(token, getJwtSecret());
        if (!payload || payload.typ !== "at") return res.status(401).send("invalid token type");
        if ((payload.role || "").toLowerCase() !== "admin") return res.status(403).send("forbidden");
    } catch {
        return res.status(401).send("invalid token");
    }

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

function getJwtSecret(): string {
    const s = (process.env.JWT_SECRET || "").trim();
    if (s) return s;
    if (!(global as any).__JWT_SECRET_DEV__) {
        (global as any).__JWT_SECRET_DEV__ = require("crypto").randomBytes(32).toString("hex");
    }
    return (global as any).__JWT_SECRET_DEV__;
}


