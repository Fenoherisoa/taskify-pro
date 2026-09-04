export type TaskStatus = 'compte créé' | 'compte suspendu' | 'en attente' | 'vérifié' | 'annulé' | 'pending';

export type AccountStatus = 'pending_verification' | 'verified' | 'suspended';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type VerificationMethod = 'ADMIN' | 'BOT' | 'NONE';
export type VerificationResult = 'GREEN' | 'RED' | 'PENDING';

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
  accountStatus?: AccountStatus;
  verificationStatus?: VerificationStatus;
  verificationMethod?: VerificationMethod;
  verificationResult?: VerificationResult;
  validationStatus?: 'pending' | 'validated' | 'rejected';
  validationReason?: string | null;
  validatedAt?: string | null;
  validatedBy?: string | null;
  rewardUSD?: number;
  rewardPaid?: boolean;
  rewardPaidAt?: string | null;
  accountCreated?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncedToGoogleSheets: boolean;
  taskType?: string;
}

export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER';

export const ALL_PERMISSIONS = [
  'dashboard',
  'users',
  'tasks',
  'validation',
  'wallets',
  'transactions',
  'withdrawals',
  'reports',
  'settings',
  'staff',
  'google_sheets',
  'audit_logs'
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

export interface StaffMember {
  id: number;
  username: string;
  fullName: string;
  role: StaffRole;
  permissions: Permission[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled';

export interface WithdrawalRecord {
  id: number;
  userId: number;
  telegramUserId?: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  amount: number;
  method: string;
  destination: string;
  status: WithdrawalStatus;
  adminId?: string;
  adminNotes?: string;
  createdAt: string;
  processedAt?: string | null;
}

export interface WalletRecord {
  id: number;
  userId: number;
  telegramUserId?: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  balance: number;
  pendingWithdrawal: number;
  totalEarned: number;
  totalWithdrawn: number;
  updatedAt: string;
}

export interface TransactionRecord {
  id: number;
  userId: number;
  telegramUserId?: string;
  telegramUsername?: string;
  taskId?: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
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
  facebookCheckerApiUrl?: string;
  facebookCheckerApiKey?: string;
  autoBotCheckEnabled?: boolean;
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
