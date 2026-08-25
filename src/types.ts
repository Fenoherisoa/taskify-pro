export type TaskStatus = 'compte créé' | 'compte suspendu' | 'en attente' | 'vérifié' | 'annulé';

export interface TaskRecord {
  id: string;
  uid: string;
  cookies: string;
  firstName: string;
  lastName: string;
  password: string;
  telegramUserId: string;
  telegramUsername: string;
  status: TaskStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncedToGoogleSheets: boolean;
  taskType?: string;
}

export type GoogleSheetField =
  | 'timestamp'
  | 'id'
  | 'status'
  | 'uid'
  | 'firstName'
  | 'lastName'
  | 'password'
  | 'cookies'
  | 'telegramUserId'
  | 'telegramUsername'
  | 'notes'
  | 'taskType'
  | 'rewardUSD';

export interface GoogleSheetFieldConfig {
  field: GoogleSheetField;
  label: string;
  enabled: boolean;
}

export interface BotSettings {
  botToken: string;
  customPassword: string;
  googleSheetWebhookUrl: string;
  googleSheetFields?: GoogleSheetField[];
  platformName: string;
  isBotActive: boolean;
  mode: 'polling' | 'webhook';
  webhookUrl?: string;
  lastSyncedAt?: string | null;
  welcomeMessage?: string;
}

export interface BotLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  source: 'telegram' | 'sheets' | 'system' | 'simulator';
  message: string;
  data?: any;
}

export interface TelegramSimulatedMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  keyboard?: {
    text: string;
    action: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
  }[][];
}

export type BotStep = 
  | 'START' 
  | 'TASK_SELECTED' 
  | 'AUTH_CHOICE' 
  | 'CREDENTIALS_SHOWN' 
  | 'AWAITING_UID' 
  | 'AWAITING_COOKIES' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | '2FA_NOTICE';
