import { Pool } from "pg";

export async function deleteUser(pool: Pool, id: number) {
    if (!Number.isFinite(id) || id <= 0) throw new Error("invalid id");
    const res = await pool.query("DELETE FROM users WHERE id=$1", [id]);
    if (res.rowCount === 0) throw new Error("not found");
}


