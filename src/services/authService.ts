import crypto from 'crypto';
import { pool } from './database';
import { StaffMember, StaffRole, Permission, ALL_PERMISSIONS } from '../types';
import { logAudit } from './auditService';

// Fallback in-memory staff for offline/mock development
const mockStaff: any[] = [
  {
    id: 1,
    username: 'admin',
    password_hash: crypto.scryptSync('AdminPassword@2025!', 'salt_taskify_master', 64).toString('hex'),
    salt: 'salt_taskify_master',
    full_name: 'Super Administrateur',
    role: 'SUPER_ADMIN',
    permissions: ALL_PERMISSIONS,
    is_active: true,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const mockSessions: Map<string, { staffId: number; expiresAt: number }> = new Map();

/**
 * Hash password using scrypt
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return { hash, salt: s };
}

/**
 * Timing-safe password verification
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(testHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Initialize default Super Admin if none exists
 */
export async function initSuperAdmin(): Promise<void> {
  try {
    const res = await pool.query('SELECT COUNT(*)::integer as count FROM staff');
    const count = Number(res.rows[0]?.count || 0);
    if (count === 0) {
      const { hash, salt } = hashPassword('AdminPassword@2025!');
      await pool.query(
        `
        INSERT INTO staff (username, password_hash, salt, full_name, role, permissions, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          'admin',
          hash,
          salt,
          'Super Administrateur',
          'SUPER_ADMIN',
          JSON.stringify(ALL_PERMISSIONS),
          true
        ]
      );
      console.log('✅ Default Super Admin account initialized (admin)');
    }
  } catch (err: any) {
    console.warn('⚠️ Super Admin initialization notice:', err.message);
  }
}

/**
 * Login staff member and generate session token (valid for 24h)
 */
export async function loginStaff(
  username: string,
  pass: string
): Promise<{ success: boolean; token?: string; staff?: StaffMember; message?: string }> {
  try {
    // 1. Query staff from DB
    const res = await pool.query(
      `SELECT * FROM staff WHERE LOWER(username) = LOWER($1) AND is_active = TRUE`,
      [username.trim()]
    );

    let staffRow = res.rows[0];

    // Check mock fallback if not in DB
    if (!staffRow) {
      const mock = mockStaff.find(
        s => s.username.toLowerCase() === username.trim().toLowerCase() && s.is_active
      );
      if (mock) {
        staffRow = mock;
      }
    }

    if (!staffRow) {
      return { success: false, message: 'Identifiants invalides ou compte désactivé' };
    }

    const isValid = verifyPassword(pass, staffRow.password_hash, staffRow.salt);
    if (!isValid) {
      return { success: false, message: 'Identifiants invalides' };
    }

    // Generate random secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

    // Save session in DB
    try {
      await pool.query(
        `INSERT INTO sessions (token, staff_id, expires_at) VALUES ($1, $2, $3)`,
        [token, staffRow.id, expiresAt]
      );
      await pool.query(
        `UPDATE staff SET last_login_at = NOW() WHERE id = $1`,
        [staffRow.id]
      );
    } catch {
      // Mock session fallback
      mockSessions.set(token, { staffId: staffRow.id, expiresAt: expiresAt.getTime() });
      staffRow.last_login_at = new Date().toISOString();
    }

    let parsedPermissions: Permission[] = ALL_PERMISSIONS as unknown as Permission[];
    if (Array.isArray(staffRow.permissions)) {
      parsedPermissions = staffRow.permissions;
    } else if (typeof staffRow.permissions === 'string') {
      try {
        parsedPermissions = JSON.parse(staffRow.permissions);
      } catch {
        parsedPermissions = [];
      }
    }

    const staff: StaffMember = {
      id: staffRow.id,
      username: staffRow.username,
      fullName: staffRow.full_name || staffRow.username,
      role: staffRow.role as StaffRole,
      permissions: parsedPermissions,
      isActive: Boolean(staffRow.is_active),
      lastLoginAt: staffRow.last_login_at ? new Date(staffRow.last_login_at).toISOString() : null,
      createdAt: staffRow.created_at ? new Date(staffRow.created_at).toISOString() : new Date().toISOString()
    };

    logAudit('staff_login', staff.username, { role: staff.role }).catch(() => {});

    return { success: true, token, staff };
  } catch (err: any) {
    console.error('❌ Login error:', err);
    return { success: false, message: err.message || 'Erreur de connexion' };
  }
}

/**
 * Verify token and return staff member
 */
export async function verifySession(token: string): Promise<StaffMember | null> {
  if (!token) return null;

  try {
    const res = await pool.query(
      `
      SELECT 
        s.*,
        st.username,
        st.full_name,
        st.role,
        st.permissions,
        st.is_active,
        st.last_login_at,
        st.created_at as staff_created_at
      FROM sessions s
      INNER JOIN staff st ON st.id = s.staff_id
      WHERE s.token = $1 AND s.expires_at > NOW() AND st.is_active = TRUE
      `,
      [token]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      let perms: Permission[] = ALL_PERMISSIONS as unknown as Permission[];
      if (Array.isArray(row.permissions)) {
        perms = row.permissions;
      } else if (typeof row.permissions === 'string') {
        try { perms = JSON.parse(row.permissions); } catch { perms = []; }
      }

      return {
        id: row.staff_id,
        username: row.username,
        fullName: row.full_name || row.username,
        role: row.role as StaffRole,
        permissions: perms,
        isActive: Boolean(row.is_active),
        lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
        createdAt: row.staff_created_at ? new Date(row.staff_created_at).toISOString() : new Date().toISOString()
      };
    }

    // Mock fallback
    const mockSess = mockSessions.get(token);
    if (mockSess && mockSess.expiresAt > Date.now()) {
      const mock = mockStaff.find(s => s.id === mockSess.staffId && s.is_active);
      if (mock) {
        return {
          id: mock.id,
          username: mock.username,
          fullName: mock.full_name,
          role: mock.role,
          permissions: mock.permissions,
          isActive: mock.is_active,
          lastLoginAt: mock.last_login_at,
          createdAt: mock.created_at
        };
      }
    }

    return null;
  } catch (err: any) {
    console.error('❌ Session verification error:', err.message);
    return null;
  }
}

/**
 * Invalidate session token
 */
export async function logoutStaff(token: string): Promise<boolean> {
  try {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    mockSessions.delete(token);
    return true;
  } catch {
    mockSessions.delete(token);
    return true;
  }
}

/**
 * Get all staff members (Super Admin only)
 */
export async function getAllStaff(): Promise<StaffMember[]> {
  try {
    const res = await pool.query(
      `SELECT id, username, full_name, role, permissions, is_active, last_login_at, created_at FROM staff ORDER BY id ASC`
    );

    if (res.rows.length > 0) {
      return res.rows.map(row => {
        let perms: Permission[] = [];
        if (Array.isArray(row.permissions)) {
          perms = row.permissions;
        } else if (typeof row.permissions === 'string') {
          try { perms = JSON.parse(row.permissions); } catch {}
        }
        return {
          id: row.id,
          username: row.username,
          fullName: row.full_name || row.username,
          role: row.role as StaffRole,
          permissions: perms,
          isActive: Boolean(row.is_active),
          lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
        };
      });
    }

    return mockStaff.map(s => ({
      id: s.id,
      username: s.username,
      fullName: s.full_name,
      role: s.role,
      permissions: s.permissions,
      isActive: s.is_active,
      lastLoginAt: s.last_login_at,
      createdAt: s.created_at
    }));
  } catch (err: any) {
    console.error('❌ Failed to get staff list:', err.message);
    return [];
  }
}

/**
 * Create a new staff member (Super Admin action)
 */
export async function createStaffMember(data: {
  username: string;
  password: string;
  fullName: string;
  role: StaffRole;
  permissions?: Permission[];
}): Promise<{ success: boolean; staff?: StaffMember; message?: string }> {
  try {
    const { hash, salt } = hashPassword(data.password);
    const perms = data.role === 'SUPER_ADMIN' 
      ? ALL_PERMISSIONS 
      : (data.permissions || ['dashboard', 'tasks', 'validation']);

    const res = await pool.query(
      `
      INSERT INTO staff (username, password_hash, salt, full_name, role, permissions, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id, username, full_name, role, permissions, is_active, last_login_at, created_at
      `,
      [
        data.username.trim(),
        hash,
        salt,
        data.fullName.trim(),
        data.role,
        JSON.stringify(perms)
      ]
    );

    const row = res.rows[0];
    const createdStaff: StaffMember = {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      role: row.role as StaffRole,
      permissions: perms as Permission[],
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(row.created_at).toISOString()
    };

    logAudit('create_staff', 'admin', { username: data.username, role: data.role }).catch(() => {});

    return { success: true, staff: createdStaff };
  } catch (err: any) {
    console.error('❌ Error creating staff member:', err.message);
    return { success: false, message: err.message || 'Erreur lors de la création du compte staff' };
  }
}

/**
 * Update staff member role, permissions, or status
 */
export async function updateStaffMember(
  id: number,
  updates: {
    fullName?: string;
    role?: StaffRole;
    permissions?: Permission[];
    isActive?: boolean;
    password?: string;
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.fullName !== undefined) {
      fields.push(`full_name = $${idx++}`);
      values.push(updates.fullName);
    }
    if (updates.role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(updates.role);
    }
    if (updates.permissions !== undefined) {
      fields.push(`permissions = $${idx++}`);
      values.push(JSON.stringify(updates.permissions));
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(updates.isActive);
    }
    if (updates.password) {
      const { hash, salt } = hashPassword(updates.password);
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
      fields.push(`salt = $${idx++}`);
      values.push(salt);
    }

    if (fields.length === 0) {
      return { success: true };
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE staff SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );

    logAudit('update_staff', 'admin', { staffId: id, fields }).catch(() => {});

    return { success: true };
  } catch (err: any) {
    console.error('❌ Error updating staff member:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Permission check helper
 */
export function hasPermission(staff: StaffMember, permission: Permission): boolean {
  if (staff.role === 'SUPER_ADMIN') return true;
  return staff.permissions.includes(permission);
}
