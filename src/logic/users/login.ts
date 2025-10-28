import { Pool } from "pg";
import jwt from "jsonwebtoken";
import { scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (password: string | Buffer, salt: string | Buffer, keylen: number) => Promise<Buffer>;

export interface LoginInput {
	identifier: string; // username 或 email
	password: string;
}

export interface LoginResult {
	user: {
		id: number;
		uuid: string;
		username: string;
		email: string;
        role?: string;
	};
	accessToken: string; // 短token（用于请求数据）
	refreshToken: string; // 长token（用于换取短token）
}

export async function login(pool: Pool, input: LoginInput): Promise<LoginResult> {
	const identifier = (input.identifier || "").trim();
	const password = input.password || "";
	if (!identifier) throw new Error("identifier is required");
	if (!password) throw new Error("password is required");

    const sql = `SELECT id, uuid::text AS uuid, username, email, password_hash, role FROM users WHERE username=$1 OR email=$1 LIMIT 1`;
    const res = await pool.query<{ id: number; uuid: string; username: string; email: string; password_hash: string; role: string }>(sql, [identifier]);
	if (res.rowCount === 0) throw new Error("invalid credentials");
	const row = res.rows[0];

	await verifyPassword(password, row.password_hash);

	const secret = getJwtSecret();
    const accessToken = jwt.sign(
        { sub: String(row.id), uid: row.uuid, username: row.username, email: row.email, role: row.role, typ: "at" },
        secret,
        { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
        { sub: String(row.id), uid: row.uuid, role: row.role, typ: "rt" },
        secret,
        { expiresIn: "30d" }
    );

	return {
        user: { id: row.id, uuid: row.uuid, username: row.username, email: row.email, role: row.role },
		accessToken,
		refreshToken,
	};
}

export async function exchangeAccessToken(refreshToken: string): Promise<string> {
	const secret = getJwtSecret();
	try {
		const payload = jwt.verify(refreshToken, secret) as any;
		if (!payload || payload.typ !== "rt") throw new Error("invalid token type");
        const accessToken = jwt.sign(
            { sub: payload.sub, uid: payload.uid, role: payload.role, typ: "at" },
            secret,
            { expiresIn: "15m" }
        );
		return accessToken;
	} catch (e) {
		throw new Error("invalid refresh token");
	}
}

// 使用长token直接完成登录（跳过口令校验）：签发新的短token并返回用户信息
export async function loginWithRefreshToken(pool: Pool, refreshToken: string): Promise<LoginResult> {
	const secret = getJwtSecret();
	let payload: any;
	try {
		payload = jwt.verify(refreshToken, secret);
		if (!payload || payload.typ !== "rt") throw new Error("invalid token type");
	} catch {
		throw new Error("invalid refresh token");
	}

	const userId = Number(payload.sub);
	if (!Number.isFinite(userId) || userId <= 0) throw new Error("invalid refresh token");
    const ures = await pool.query<{ id: number; uuid: string; username: string; email: string; role: string }>(
        "SELECT id, uuid::text AS uuid, username, email, role FROM users WHERE id=$1",
		[userId]
	);
	if (ures.rowCount === 0) throw new Error("invalid refresh token");
	const user = ures.rows[0];

    const accessToken = jwt.sign(
        { sub: String(user.id), uid: user.uuid, username: user.username, email: user.email, role: user.role, typ: "at" },
        secret,
        { expiresIn: "15m" }
    );

	return {
        user: { id: user.id, uuid: user.uuid, username: user.username, email: user.email, role: user.role },
		accessToken,
		refreshToken,
	};
}

async function verifyPassword(password: string, stored: string): Promise<void> {
	// 格式: scrypt$<salt>$<hashBase64>
	const parts = (stored || "").split("$");
	if (parts.length !== 3 || parts[0] !== "scrypt") throw new Error("invalid credentials");
	const salt = Buffer.from(parts[1], "base64");
	const expected = Buffer.from(parts[2], "base64");
	const actual = await scrypt(password, salt, expected.length);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
		throw new Error("invalid credentials");
	}
}

function getJwtSecret(): string {
	const s = (process.env.JWT_SECRET || "").trim();
	if (s) return s;
	// 开发降级: 使用进程级随机密钥（重启即失效）
	if (!(global as any).__JWT_SECRET_DEV__) {
		(global as any).__JWT_SECRET_DEV__ = require("crypto").randomBytes(32).toString("hex");
	}
	return (global as any).__JWT_SECRET_DEV__;
}


