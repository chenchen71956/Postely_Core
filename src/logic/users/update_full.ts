import { Pool } from "pg";
import { randomBytes, scrypt as _scrypt } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (password: string | Buffer, salt: string | Buffer, keylen: number) => Promise<Buffer>;

export interface FullUpdateInput {
    username?: string;
    email?: string;
    password?: string; // 如果提供则会重新计算 password_hash
    role?: string; // 'user' | 'admin'
    two_factor_enabled?: boolean;
    email_verified_at?: string | null;
    last_login_at?: string | null;
    last_login_ip?: string | null;
}

export async function updateUserFull(pool: Pool, id: number, input: FullUpdateInput) {
    if (!Number.isFinite(id) || id <= 0) throw new Error("invalid id");
    const fields: string[] = [];
    const args: any[] = [];
    let idx = 1;

    if (input.username !== undefined) {
        const v = (input.username || "").trim();
        if (!v) throw new Error("username is required");
        fields.push(`username = $${idx++}`);
        args.push(v);
    }
    if (input.email !== undefined) {
        const v = (input.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error("invalid email");
        fields.push(`email = $${idx++}`);
        args.push(v);
    }
    if (input.role !== undefined) {
        const v = (input.role || "").toLowerCase();
        if (v !== "user" && v !== "admin") throw new Error("invalid role");
        fields.push(`role = $${idx++}`);
        args.push(v);
    }
    if (input.two_factor_enabled !== undefined) {
        fields.push(`two_factor_enabled = $${idx++}`);
        args.push(!!input.two_factor_enabled);
    }
    if (input.email_verified_at !== undefined) {
        fields.push(`email_verified_at = $${idx++}`);
        args.push(input.email_verified_at);
    }
    if (input.last_login_at !== undefined) {
        fields.push(`last_login_at = $${idx++}`);
        args.push(input.last_login_at);
    }
    if (input.last_login_ip !== undefined) {
        fields.push(`last_login_ip = $${idx++}`);
        args.push(input.last_login_ip);
    }
    if (input.password !== undefined) {
        const pwd = input.password || "";
        if (pwd.length < 8) throw new Error("password must be at least 8 characters");
        const salt = randomBytes(16).toString("base64");
        const hash = (await scrypt(pwd, salt, 64)).toString("base64");
        const passwordHash = `scrypt$${salt}$${hash}`;
        fields.push(`password_hash = $${idx++}`);
        args.push(passwordHash);
    }

    if (fields.length === 0) throw new Error("no fields to update");

    fields.push(`updated_at = now()`);

    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id`;
    args.push(id);
    const res = await pool.query<{ id: number }>(sql, args);
    if (res.rowCount === 0) throw new Error("not found");
    return res.rows[0].id;
}


