import { Request, Response } from "express";
import { Pool } from "pg";
import { registerAndIssueTokens, RegisterInput, RegisterAndTokensResult } from "../../logic/users/register";

export async function registerUserHandler(req: Request, res: Response) {
	if (req.method !== "POST") {
		return res.status(405).send("method not allowed");
	}
	const pool = req.app.get("pool") as Pool | undefined;
	if (!pool) return res.status(500).send("database not initialized");

	const body = (req.body || {}) as Partial<RegisterInput>;
	const username = (body.username || "").trim();
	const email = (body.email || "").trim();
	const password = body.password || "";
	if (!username) return res.status(400).send("username is required");
	if (!email) return res.status(400).send("email is required");
	if (!password) return res.status(400).send("password is required");

    try {
        const result: RegisterAndTokensResult = await registerAndIssueTokens(pool, { username, email, password });
        return res.status(201).json({
            user: {
                id: result.id,
                uuid: result.uuid,
                username: result.username,
                email: result.email,
                created_at: result.created_at,
            },
            access_token: result.accessToken,
            refresh_token: result.refreshToken,
        });
	} catch (e: any) {
		const msg = String(e?.message || e || "error");
		if (msg.includes("already exists")) return res.status(409).send(msg);
        if (msg.includes("required") || msg.includes("at least") || msg.includes("invalid email")) return res.status(400).send(msg);
		return res.status(500).send("internal error");
	}
}


