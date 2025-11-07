import { Request, Response } from "express";
import { Pool } from "pg";
import { login, exchangeAccessToken, loginWithRefreshToken } from "../../logic/users/login";

export async function loginHandler(req: Request, res: Response) {
	if (req.method !== "POST") return res.status(405).send("method not allowed");
	const pool = req.app.get("pool") as Pool | undefined;
	if (!pool) return res.status(500).send("database not initialized");

	const { identifier, password, refresh_token } = (req.body || {}) as { identifier?: string; password?: string; refresh_token?: string };
    if ((process.env.DEBUG_AUTH || "") === "1") {
        try {
            const keys = Object.keys((req.body as any) || {});
            const hasPwdSpace = typeof password === "string" && password !== password.trim();
            console.log("[auth] ctype=", req.headers["content-type"], "keys=", keys, "identifier=", String(identifier || "").slice(0, 80), "pwd_len=", typeof password === "string" ? password.length : -1, "pwd_trim_changed=", hasPwdSpace);
        } catch {}
    }
	try {
		// 若提供长token，则直接跳过口令校验，签发短token并返回用户信息
		if ((refresh_token || "").trim()) {
			const r = await loginWithRefreshToken(pool, refresh_token!.trim());
			return res.json({ user: r.user, access_token: r.accessToken, refresh_token: r.refreshToken });
		}
		const result = await login(pool, { identifier: identifier || "", password: password || "" });
		return res.json({
			user: result.user,
			access_token: result.accessToken,
			refresh_token: result.refreshToken,
		});
	} catch (e: any) {
		const msg = String(e?.message || e || "error");
		if (msg.includes("invalid credentials")) {
			if ((process.env.DEBUG_AUTH || "") === "1") {
				// 在调试模式下返回更具体的原因，便于定位（切勿在生产泄露细节）
				return res.status(401).send(msg);
			}
			return res.status(401).send("invalid credentials");
		}
		if (msg.includes("required") || msg.includes("invalid refresh token")) return res.status(400).send(msg);
		return res.status(500).send("internal error");
	}
}

export async function tokenHandler(req: Request, res: Response) {
	if (req.method !== "POST") return res.status(405).send("method not allowed");
    const pool = req.app.get("pool") as Pool | undefined;
    if (!pool) return res.status(500).send("database not initialized");
	const { refresh_token } = (req.body || {}) as { refresh_token?: string };
	if (!refresh_token) return res.status(400).send("refresh_token is required");
	try {
        const accessToken = await exchangeAccessToken(pool, refresh_token);
		return res.json({ access_token: accessToken });
	} catch {
		return res.status(401).send("invalid refresh token");
	}
}


