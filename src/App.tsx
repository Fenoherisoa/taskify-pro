import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { TasksTable } from './components/TasksTable';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { AnalyticsView } from './components/AnalyticsView';
import { BotSimulator } from './components/BotSimulator';
import { BotSettingsView } from './components/BotSettingsView';
import { GoogleAppsScriptView } from './components/GoogleAppsScriptView';
import { DeploymentTutorialView } from './components/DeploymentTutorialView';
import { LiveLogsView } from './components/LiveLogsView';
import { ExportModal } from './components/ExportModal';
import TelegramMiniApp from './components/TelegramMiniApp';
import { TaskRecord, BotSettings, BotLog, TaskStatus } from './types';
import { 
  fetchTasks, 
  fetchSettings, 
  fetchLogs, 
  updateTaskStatus, 
  updateTask, 
  deleteTask, 
  createTask, 
  saveSettings, 
  sendToGoogleSheetsWebhook 
} from './services/apiService';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('tasks');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [settings, setSettings] = useState<BotSettings>({
    botToken: '',
    customPassword: 'TaskPassword@2025!',
    googleSheetWebhookUrl: '',
    googleSheetFields: [
      'timestamp',
      'id',
      'status',
      'uid',
      'firstName',
      'lastName',
      'telegramUserId',
      'telegramUsername'
    ],
    platformName: 'Task By RFC Office',
    isBotActive: false,
    mode: 'polling',
    welcomeMessage: 'Bienvenue sur Task By RFC Office'
  });
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  
  // Modals
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch tasks & settings
  const loadData = useCallback(async () => {
    try {
      const [tasksData, settingsData, logsData] = await Promise.all([
        fetchTasks(),
        fetchSettings(),
        fetchLogs()
      ]);
      setTasks(tasksData);
      setSettings(settingsData);
      setLogs(logsData);
    } catch (err) {
      console.warn('Silent data refresh:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // 10s polling
    return () => clearInterval(interval);
  }, [loadData]);

  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    const updated = await updateTaskStatus(taskId, newStatus);
    setTasks(updated);
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<TaskRecord>) => {
    const updated = await updateTask(taskId, updates);
    setTasks(updated);
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const updated = await deleteTask(taskId);
    setTasks(updated);
    if (selectedTask?.id === taskId) setSelectedTask(null);
  };

  const handleCreateTask = async (taskData: any) => {
    const { allTasks } = await createTask(taskData, settings);
    setTasks(allTasks);
  };

  const handleSaveSettings = async (newSettings: Partial<BotSettings>) => {
    const updated = await saveSettings(newSettings);
    setSettings(updated);
  };

  const handleTestGoogleSheets = async (url: string) => {
    const dummyTask: TaskRecord = {
      id: `task-test-${Date.now()}`,
      uid: 'TEST_UID_999999',
      cookies: 'datr=sample_test; c_user=TEST_UID_999999',
      firstName: 'Jean',
      lastName: 'Dupont',
      password: settings.customPassword,
      telegramUserId: 'test_admin',
      telegramUsername: 'admin_rfc',
      status: 'compte créé',
      notes: 'Ligne de test générée par le tableau de bord',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedToGoogleSheets: true,
      taskType: 'Facebook'
    };
    return await sendToGoogleSheetsWebhook(dummyTask, url);
  };

  const handleSyncAllSheets = async () => {
    if (!settings.googleSheetWebhookUrl) {
      alert('Veuillez d\'abord renseigner une URL Google Sheet dans les Paramètres.');
      return;
    }

    setIsSyncing(true);
    let count = 0;
    try {
      for (const task of tasks) {
        const res = await sendToGoogleSheetsWebhook(task, settings.googleSheetWebhookUrl);
        if (res.success) count++;
      }
      alert(`✅ Synchronisation terminée ! ${count} tâche(s) transmise(s) à Google Sheets.`);
      loadData();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const isTelegramMiniApp =
    new URLSearchParams(window.location.search).get('telegramMiniApp') === '1';

  if (isTelegramMiniApp) {
    return (
      <TelegramMiniApp
        onAction={(action) => {
          console.log('Telegram Mini App action:', action);

          const routes: Record<string, string> = {
            balance: '/?telegramAction=balance',
            tasks: '/?telegramAction=tasks',
            withdraw: '/?telegramAction=withdraw',
            support: '/?telegramAction=support',
            referrals: '/?telegramAction=referrals',
            leaderboard: '/?telegramAction=leaderboard',
            language: '/?telegramAction=language'
          };

          const target = routes[action];

          if (target) {
            window.location.href = target;
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white font-sans antialiased">
      {/* Top Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        tasks={tasks}
        onRefresh={loadData}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onSyncSheets={handleSyncAllSheets}
        isSyncing={isSyncing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab 1: Tasks & Accounts List */}
        {activeTab === 'tasks' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <StatsCards
              tasks={tasks}
              settings={settings}
              onFilterStatus={setSelectedFilter}
              selectedFilter={selectedFilter}
            />

            <TasksTable
              tasks={tasks}
              onSelectTask={setSelectedTask}
              onUpdateStatus={handleUpdateStatus}
              onDeleteTask={handleDeleteTask}
              selectedFilter={selectedFilter}
              onFilterChange={setSelectedFilter}
            />
          </div>
        )}

        {/* Tab 2: Interactive Telegram Bot Simulator */}
        {activeTab === 'simulator' && (
          <div className="animate-in fade-in duration-200" data-tab="simulator">
            <BotSimulator
              settings={settings}
              onNewTaskCreated={(newTask) => {
                setTasks(prev => [newTask, ...prev]);
              }}
              onRefreshTasks={loadData}
            />
          </div>
        )}

        {/* Tab 3: Analytics & Visual Tracking */}
        {activeTab === 'analytics' && (
          <div className="animate-in fade-in duration-200">
            <AnalyticsView tasks={tasks} />
          </div>
        )}

        {/* Tab 4: Bot Settings */}
        {activeTab === 'settings' && (
          <div className="animate-in fade-in duration-200">
            <BotSettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onTestGoogleSheets={handleTestGoogleSheets}
            />
          </div>
        )}

        {/* Tab 5: Google Apps Script Backend Code */}
        {activeTab === 'google-sheets' && (
          <div className="animate-in fade-in duration-200">
            <GoogleAppsScriptView />
          </div>
        )}

        {/* Tab 6: Free 0€ Deployment Tutorial */}
        {activeTab === 'tutorial' && (
          <div className="animate-in fade-in duration-200">
            <DeploymentTutorialView />
          </div>
        )}

        {/* Tab 7: Real-time Live Logs */}
        {activeTab === 'logs' && (
          <div className="animate-in fade-in duration-200">
            <LiveLogsView logs={logs} onRefresh={loadData} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Task By RFC Office • Système d'Automatisation & Gestion de Comptes</span>
          <span className="font-mono text-[11px] text-slate-400">100% Free Tier Hosted • Google Sheets API • Telegraf Bot</span>
        </div>
      </footer>

      {/* Modals */}
      <TaskDetailsModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdateTask={handleUpdateTask}
        onSyncSingle={async (task) => {
          await fetch('/api/test-google-sheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: settings.googleSheetWebhookUrl })
          });
          alert(`Tentative de synchronisation envoyée pour ${task.uid}`);
          loadData();
        }}
      />

      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateTask}
        settings={settings}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}
