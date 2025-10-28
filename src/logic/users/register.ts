import { Pool } from "pg";
import { randomBytes, scrypt as _scrypt } from "crypto";
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
	const password = input.password || "";
	if (!username) throw new Error("username is required");
	if (!email) throw new Error("email is required");
	if (!password || password.length < 6) throw new Error("password must be at least 6 characters");

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


