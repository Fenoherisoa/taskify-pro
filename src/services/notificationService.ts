import { pool } from './database';
import { NotificationRecord } from '../types';

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string = 'info'
): Promise<void> {
  try {
    await pool.query(
      `
      INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
      VALUES ($1, $2, $3, $4, FALSE, NOW())
      `,
      [userId, title, message, type]
    );
  } catch (err: any) {
    console.warn('⚠️ Could not insert notification:', err.message);
  }
}

export async function getUserNotifications(telegramUserId: string): Promise<NotificationRecord[]> {
  try {
    const res = await pool.query(
      `
      SELECT n.*
      FROM notifications n
      INNER JOIN users u ON u.id = n.user_id
      WHERE u.telegram_user_id = $1
      ORDER BY n.id DESC
      LIMIT 50
      `,
      [String(telegramUserId)]
    );

    return res.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      message: row.message,
      type: row.type || 'info',
      isRead: Boolean(row.is_read),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    }));
  } catch (err: any) {
    console.warn('⚠️ Could not fetch notifications:', err.message);
    return [];
  }
}

export async function markNotificationsRead(telegramUserId: string): Promise<void> {
  try {
    await pool.query(
      `
      UPDATE notifications n
      SET is_read = TRUE
      FROM users u
      WHERE n.user_id = u.id AND u.telegram_user_id = $1
      `,
      [String(telegramUserId)]
    );
  } catch (err: any) {
    console.warn('⚠️ Could not mark notifications as read:', err.message);
  }
}
