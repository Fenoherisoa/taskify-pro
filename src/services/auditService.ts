import { pool } from './database';

export interface AuditLog {
  id: number;
  action: string;
  actor_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

export async function logAudit(
  action: string,
  actorId?: string | null,
  details: Record<string, any> = {}
): Promise<AuditLog | null> {
  try {
    const res = await pool.query(
      `
      INSERT INTO audit_logs (action, actor_id, details)
      VALUES ($1, $2, $3)
      RETURNING id, action, actor_id, details, created_at
      `,
      [action, actorId || null, JSON.stringify(details)]
    );
    return res.rows[0] || null;
  } catch (err: any) {
    console.warn('⚠️ Could not record audit log:', err.message);
    return null;
  }
}

export async function getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
  try {
    const res = await pool.query(
      `
      SELECT id, action, actor_id, details, created_at
      FROM audit_logs
      ORDER BY id DESC
      LIMIT $1
      `,
      [limit]
    );
    return res.rows || [];
  } catch (err: any) {
    console.warn('⚠️ Could not fetch audit logs:', err.message);
    return [];
  }
}
