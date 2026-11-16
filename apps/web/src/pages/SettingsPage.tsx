import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, type SystemSettings } from '../api';
import {
  User as UserIcon,
  KeyRound,
  Server,
  Database,
  Cpu,
  Layers,
  Sparkles,
  GitPullRequest,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    setLoadingSettings(true);
    api.getSettings()
      .then(res => setSettings(res))
      .catch(err => console.error('Failed to load system settings:', err))
      .finally(() => setLoadingSettings(false));
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }

    setChangingPw(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setPwSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password.');
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account & System Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your credentials, review active integrations, and inspect runtime health.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <UserIcon className="w-4 h-4 text-emerald-600" />
            <span>Developer Profile</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Name</span>
              <span className="text-slate-800 font-semibold text-sm">{user?.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Email</span>
              <span className="text-slate-800 font-mono text-sm">{user?.email}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Member Since</span>
              <span className="text-slate-600">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active session'}
              </span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            <span>Change Password</span>
          </div>

          {pwError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{pwError}</span>
            </div>
          )}

          {pwSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{pwSuccess}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                New Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={changingPw}
              className="mt-2 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {changingPw ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* System Health & Integration Status */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Server className="w-4 h-4 text-emerald-600" />
            <span>System Health & Integration Capabilities</span>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            v1.0.0 Stable
          </span>
        </div>

        {loadingSettings ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
            <span>Inspecting system parameters...</span>
          </div>
        ) : settings ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Database */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-600" />
                  Database
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                  {settings.dbStatus}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">PostgreSQL (Dual-Mode Engine)</p>
            </div>

            {/* Queue Engine */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-600" />
                  Queue Service
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                  {settings.queueState.type}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Active workers: {settings.queueState.activeWorkers} • Pending: {settings.queueState.pendingJobs}
              </p>
            </div>

            {/* Execution Isolation */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-600" />
                  Execution Isolation
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800">
                  {settings.runnerType.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">Process-tree bounded runner with strict timeouts</p>
            </div>

            {/* GitHub API */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <GitPullRequest className="w-3.5 h-3.5 text-slate-600" />
                  GitHub Integration
                </span>
                {settings.gitHubTokenConfigured ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    CONFIGURED
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                    ANONYMOUS (60/hr)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600">Pull request parser & lockfile ingestion</p>
            </div>

            {/* Gemini AI */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-slate-600" />
                  Gemini AI Enrichment
                </span>
                {settings.geminiConfigured ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    ACTIVE
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                    DETERMINISTIC ONLY
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                {settings.geminiConfigured ? settings.geminiModel : 'Optional structured enrichment disabled'}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};