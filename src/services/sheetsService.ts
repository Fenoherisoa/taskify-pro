/**
 * ============================================================
 * TASKIFY PRO - GOOGLE SHEETS SYNCHRONIZATION SERVICE
 * ============================================================
 * PostgreSQL is the primary database (source of truth).
 * Google Sheets serves as the reporting & synchronization layer.
 *
 * Implements row-updating: updates existing rows by task ID or UID
 * rather than appending duplicates.
 */

export interface SheetTaskPayload {
  id: string;
  uid: string;
  status: string;
  validationStatus?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  cookies?: string;
  telegramUserId?: string;
  telegramUsername?: string;
  notes?: string;
  taskType?: string;
  rewardUSD?: number;
  timestamp?: string;
}

export async function syncTaskToGoogleSheets(
  task: SheetTaskPayload,
  webhookUrl?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const targetUrl =
    webhookUrl ||
    process.env.GOOGLE_SHEET_WEBHOOK_URL ||
    '';

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return {
      success: false,
      error: 'Google Sheets webhook URL is not configured'
    };
  }

  const payload = {
    action: 'sync_task', // Updates existing row if found, appends if new
    timestamp: task.timestamp || new Date().toISOString(),
    id: task.id || '',
    status: task.status || 'pending',
    validationStatus: task.validationStatus || 'pending',
    uid: task.uid || '',
    firstName: task.firstName || '',
    lastName: task.lastName || '',
    password: task.password || '',
    cookies: task.cookies || '',
    telegramUserId: task.telegramUserId || '',
    telegramUsername: task.telegramUsername || '',
    notes: task.notes || '',
    taskType: task.taskType || 'Facebook',
    rewardUSD: task.rewardUSD ?? 0.04,
    // Backward-compatible nested data object:
    data: {
      timestamp: task.timestamp || new Date().toISOString(),
      id: task.id || '',
      status: task.status || 'pending',
      uid: task.uid || '',
      firstName: task.firstName || '',
      lastName: task.lastName || '',
      password: task.password || '',
      cookies: task.cookies || '',
      telegramUserId: task.telegramUserId || '',
      telegramUsername: task.telegramUsername || '',
      notes: task.notes || '',
      taskType: task.taskType || 'Facebook',
      rewardUSD: task.rewardUSD ?? 0.04
    }
  };

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.warn(`⚠️ Google Sheets sync response HTTP ${response.status}:`, responseText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText}`
      };
    }

    return {
      success: true,
      message: responseText
    };
  } catch (err: any) {
    console.warn('⚠️ Google Sheets sync network error:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}
