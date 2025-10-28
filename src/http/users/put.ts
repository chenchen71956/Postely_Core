import { Request, Response } from "express";
import { Pool } from "pg";
import jwt from "jsonwebtoken";
import { updateUserFull } from "../../logic/users/update_full";

export async function putUserHandler(req: Request, res: Response) {
    if (req.method !== "PUT") return res.status(405).send("method not allowed");
    const pool = req.app.get("pool") as Pool | undefined;
    if (!pool) return res.status(500).send("database not initialized");

    // 管理员短token校验
    const auth = req.header("authorization") || req.header("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).send("missing bearer token");
    const token = m[1];
    try {
        const payload: any = jwt.verify(token, getJwtSecret());
        if (!payload || payload.typ !== "at") return res.status(401).send("invalid token type");
    } catch {
        return res.status(401).send("invalid token");
    }
    const tokenHash = require("crypto").createHash("sha256").update(token).digest("hex");
    const q = `SELECT u.role FROM access_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.expires_at>now()`;
    const rs = await pool.query<{ role: string }>(q, [tokenHash]);
    if (rs.rowCount === 0) return res.status(401).send("invalid or expired token");
    if ((rs.rows[0].role || "").toLowerCase() !== "admin") return res.status(403).send("forbidden");

    const id = Number(req.params.id);
    const body = req.body || {};
    try {
        const updatedId = await updateUserFull(pool, id, body);
        return res.json({ id: updatedId });
    } catch (e: any) {
        const msg = String(e?.message || e || "error");
        if (msg === "not found") return res.status(404).send(msg);
        if (msg.includes("required") || msg.includes("invalid ") || msg.includes("no fields")) return res.status(400).send(msg);
        if (msg.includes("duplicate") || msg.includes("exists") || msg.includes("23505")) return res.status(409).send("conflict");
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


