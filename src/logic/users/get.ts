import { Pool } from "pg";

export interface UserRow {
    id: number;
    uuid: string;
    username: string;
    email: string;
    password_hash: string;
    role: string;
    two_factor_enabled: boolean;
    email_verified_at: string | null;
    last_login_at: string | null;
    last_login_ip: string | null;
    created_at: string;
    updated_at: string;
}

export async function getUserByUUID(pool: Pool, userUUID: string): Promise<UserRow | null> {
    const sql = `
SELECT id,
       uuid::text AS uuid,
       username,
       email,
       password_hash,
        role,
       two_factor_enabled,
       email_verified_at::text AS email_verified_at,
       last_login_at::text AS last_login_at,
       last_login_ip::text AS last_login_ip,
       created_at::text AS created_at,
       updated_at::text AS updated_at
FROM users
WHERE uuid = $1
LIMIT 1`;
    const res = await pool.query<UserRow>(sql, [userUUID]);
    if (res.rowCount === 0) return null;
    return res.rows[0];
}


