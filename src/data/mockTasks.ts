import { TaskRecord } from '../types';

export const INITIAL_TASKS: TaskRecord[] = [
  {
    id: 'task-1741160000001',
    uid: '100084928172910',
    cookies: 'datr=z476Zx14pQO5K79m1w_8h8A; c_user=100084928172910; xs=32%3Am7P901q_18aZ; fr=0d1k8m5x.AWV...',
    firstName: 'Alexandre',
    lastName: 'Martin',
    password: 'TaskPassword@2025!',
    telegramUserId: '589234102',
    telegramUsername: 'alex_op_paris',
    status: 'compte créé',
    notes: 'Compte validé avec succès, cookies conformes',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    syncedToGoogleSheets: true,
    taskType: 'Facebook'
  },
  {
    id: 'task-1741160000002',
    uid: '100092817462019',
    cookies: 'datr=w998Px99zKL2B33p0q_4j2B; c_user=100092817462019; xs=44%3Ak8Q712m_49bX; fr=1a2b3c4d...',
    firstName: 'Thomas',
    lastName: 'Bernard',
    password: 'TaskPassword@2025!',
    telegramUserId: '612984013',
    telegramUsername: 'thomas_tech',
    status: 'en attente',
    notes: 'En attente de vérification manuelle',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    syncedToGoogleSheets: false,
    taskType: 'Facebook'
  },
  {
    id: 'task-1741160000003',
    uid: '100078192847115',
    cookies: 'datr=p551Rx33vMN7C99t5y_1k9C; c_user=100078192847115; xs=18%3Av3L581x_92cW; fr=9z8y7x6w...',
    firstName: 'Camille',
    lastName: 'Dubois',
    password: 'TaskPassword@2025!',
    telegramUserId: '740192837',
    telegramUsername: 'camille_d',
    status: 'vérifié',
    notes: 'Cookies testés actifs et fonctionnels',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
    syncedToGoogleSheets: true,
    taskType: 'Facebook'
  },
  {
    id: 'task-1741160000004',
    uid: '100063920184712',
    cookies: 'datr=q112Nx44wOP8D88u6z_2m8D; c_user=100063920184712; xs=29%3Au2K492y_81dV; fr=8y7x6w5v...',
    firstName: 'Nicolas',
    lastName: 'Petit',
    password: 'TaskPassword@2025!',
    telegramUserId: '839201746',
    telegramUsername: 'nico_web',
    status: 'compte suspendu',
    notes: 'Checkpoint de sécurité détecté lors de la vérification',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    syncedToGoogleSheets: true,
    taskType: 'Facebook'
  }
];


