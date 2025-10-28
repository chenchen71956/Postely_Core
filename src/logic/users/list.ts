import { Pool } from "pg";

export interface ListUsersParams {
	limit?: number;
	offset?: number;
}

export interface PublicUserRow {
	id: number;
	uuid: string;
	username: string;
	email: string;
	two_factor_enabled: boolean;
	email_verified_at: string | null;
	last_login_at: string | null;
	last_login_ip: string | null;
	created_at: string;
	updated_at: string;
}

export async function listUsers(pool: Pool, params: ListUsersParams = {}): Promise<PublicUserRow[]> {
	const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
	const offset = Math.max(params.offset ?? 0, 0);
	const sql = `
SELECT id,
	uuid::text AS uuid,
	username,
	email,
	two_factor_enabled,
	email_verified_at::text AS email_verified_at,
	last_login_at::text AS last_login_at,
	last_login_ip::text AS last_login_ip,
	created_at::text AS created_at,
	updated_at::text AS updated_at
FROM users
ORDER BY id
LIMIT $1 OFFSET $2`;
	const res = await pool.query<PublicUserRow>(sql, [limit, offset]);
	return res.rows;
}


