import { Pool } from "pg";
import { randomBytes, scrypt as _scrypt, createHash } from "crypto";
import jwt from "jsonwebtoken";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (password: string | Buffer, salt: string | Buffer, keylen: number) => Promise<Buffer>;

export interface RegisterInput {
	username: string;
	email: string;
	password: string;
}

export interface PublicUser {
	id: number;
	uuid: string;
	username: string;
	email: string;
	created_at: string;
}

export async function registerUser(pool: Pool, input: RegisterInput): Promise<PublicUser> {
	const username = (input.username || "").trim();
    const email = (input.email || "").trim().toLowerCase();
    const rawPassword = input.password || "";
    const password = rawPassword.normalize("NFKC").trim();
	if (!username) throw new Error("username is required");
	if (!email) throw new Error("email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid email");
    if (!password || password.length < 8) throw new Error("password must be at least 8 characters");

	const salt = randomBytes(16).toString("base64");
    const hash = (await scrypt(password, salt, 64)).toString("base64");
	const passwordHash = `scrypt$${salt}$${hash}`;

	const sql = `
INSERT INTO users (username, email, password_hash)
VALUES ($1, $2, $3)
RETURNING id, uuid::text AS uuid, username, email, created_at::text AS created_at`;
	try {
		const res = await pool.query<PublicUser>(sql, [username, email, passwordHash]);
		return res.rows[0];
	} catch (e: any) {
		if (e && e.code === "23505") {
			// 唯一键冲突（username 或 email 已存在）
			throw new Error("username or email already exists");
		}
		throw e;
	}
}

export interface RegisterAndTokensResult extends PublicUser {
    accessToken: string;
    refreshToken: string;
}

export async function registerAndIssueTokens(pool: Pool, input: RegisterInput): Promise<RegisterAndTokensResult> {
    const user = await registerUser(pool, input);
    const secret = getJwtSecret();
    const accessToken = jwt.sign(
        { sub: String(user.id), uid: user.uuid, username: user.username, email: user.email, typ: "at" },
        secret,
        { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
        { sub: String(user.id), uid: user.uuid, typ: "rt" },
        secret,
        { expiresIn: "30d" }
    );
    await indexAccessToken(pool, user.id, accessToken, minutesFromNow(15));
    return { ...user, accessToken, refreshToken };
}

function getJwtSecret(): string {
    const s = (process.env.JWT_SECRET || "").trim();
    if (s) return s;
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


