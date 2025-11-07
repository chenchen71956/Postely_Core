import { Pool } from "pg";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
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
	};
	accessToken: string; // 短token（用于请求数据）
	refreshToken: string; // 长token（用于换取短token）
}

export async function login(pool: Pool, input: LoginInput): Promise<LoginResult> {
	const rawIdentifier = (input.identifier || "").trim();
	const identifier = rawIdentifier.includes("@") ? rawIdentifier.toLowerCase() : rawIdentifier;
	const password = input.password || "";
	if (!identifier) throw new Error("identifier is required");
	if (!password) throw new Error("password is required");

	    const sql = `SELECT id, uuid::text AS uuid, username, email, password_hash, role FROM users WHERE username=$1 OR lower(email)=lower($1) LIMIT 1`;
	    const res = await pool.query<{ id: number; uuid: string; username: string; email: string; password_hash: string; role: string }>(sql, [identifier]);
		if (res.rowCount === 0) {
			if ((process.env.DEBUG_AUTH || "") === "1") {
				console.log("[auth] user not found for identifier:", identifier);
			}
			throw new Error("invalid credentials: user_not_found");
		}
	const row = res.rows[0];

		if ((process.env.DEBUG_AUTH || "") === "1") {
			console.log("[auth] verifying password for user id:", row.id);
		}
		try {
			await verifyPassword(password, row.password_hash);
			if ((process.env.DEBUG_AUTH || "") === "1") {
				console.log("[auth] password ok for user id:", row.id);
			}
		} catch (e) {
			if ((process.env.DEBUG_AUTH || "") === "1") {
				console.log("[auth] password mismatch for user id:", row.id);
			}
			throw e;
		}

	const secret = getJwtSecret();
    const accessToken = jwt.sign(
        { sub: String(row.id), uid: row.uuid, username: row.username, email: row.email, typ: "at" },
        secret,
        { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
        { sub: String(row.id), uid: row.uuid, typ: "rt" },
        secret,
        { expiresIn: "30d" }
    );

    // 记录短token索引
    await indexAccessToken(pool, row.id, accessToken, minutesFromNow(15));

	return {
        user: { id: row.id, uuid: row.uuid, username: row.username, email: row.email },
		accessToken,
		refreshToken,
	};
}

export async function exchangeAccessToken(pool: Pool, refreshToken: string): Promise<string> {
	const secret = getJwtSecret();
	try {
		const payload = jwt.verify(refreshToken, secret) as any;
		if (!payload || payload.typ !== "rt") throw new Error("invalid token type");
        const accessToken = jwt.sign(
            { sub: payload.sub, uid: payload.uid, typ: "at" },
            secret,
            { expiresIn: "15m" }
        );
        await indexAccessToken(pool, Number(payload.sub), accessToken, minutesFromNow(15));
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
    const ures = await pool.query<{ id: number; uuid: string; username: string; email: string }>(
        "SELECT id, uuid::text AS uuid, username, email FROM users WHERE id=$1",
		[userId]
	);
	if (ures.rowCount === 0) throw new Error("invalid refresh token");
	const user = ures.rows[0];

    const accessToken = jwt.sign(
        { sub: String(user.id), uid: user.uuid, username: user.username, email: user.email, typ: "at" },
        secret,
        { expiresIn: "15m" }
    );
    await indexAccessToken(pool, user.id, accessToken, minutesFromNow(15));

	return {
        user: { id: user.id, uuid: user.uuid, username: user.username, email: user.email },
		accessToken,
		refreshToken,
	};
}

async function verifyPassword(password: string, stored: string): Promise<void> {
	// 格式: scrypt$<salt>$<hashBase64>
	const parts = (stored || "").split("$");
	if (parts.length !== 3 || parts[0] !== "scrypt") {
		if ((process.env.DEBUG_AUTH || "") === "1") {
			console.log("[auth] bad hash format:", parts[0], "parts_len=", parts.length);
		}
		throw new Error("invalid credentials: bad_hash_format");
	}
	const salt = Buffer.from(parts[1], "base64");
	const expected = Buffer.from(parts[2], "base64");
    const pwd = (password || "").normalize("NFKC").trim();
    if ((process.env.DEBUG_AUTH || "") === "1") {
        console.log("[auth] hash_meta algo=scrypt salt_len=", salt.length, "exp_len=", expected.length, "normalized=", true);
    }
	const actual = await scrypt(pwd, salt, expected.length);
	const sameLen = actual.length === expected.length;
	const sameHash = sameLen && timingSafeEqual(actual, expected);
	if (!sameHash) {
		if ((process.env.DEBUG_AUTH || "") === "1") {
			console.log("[auth] hash_compare mismatch: act_len=", actual.length, "exp_len=", expected.length);
		}
		throw new Error("invalid credentials: password_mismatch");
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

function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

async function indexAccessToken(pool: Pool, userId: number, token: string, expiresAt: Date): Promise<void> {
    const tokenHash = hashToken(token);
    await pool.query(
        `INSERT INTO access_tokens (token_hash, user_id, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (token_hash) DO UPDATE SET user_id=EXCLUDED.user_id, expires_at=EXCLUDED.expires_at`,
        [tokenHash, userId, expiresAt.toISOString()]
    );
}

function minutesFromNow(m: number): Date {
    return new Date(Date.now() + m * 60 * 1000);
}


