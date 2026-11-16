import type {
  AnalysisOutcome,
  AnalysisStage,
  FindingSeverity,
  EvidenceStrength,
  ChangeCategory,
  VerificationStatus,
  CheckOutcome,
  ExecutionPhase
} from '@upgradelens/contracts';

const API_BASE = '/api';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface FixtureScenario {
  id: string;
  name: string;
  description: string;
  dependencyName: string;
  baselineVersion: string;
  targetVersion: string;
  expectedOutcome: string;
}

export interface AnalysisSummary {
  id: string;
  projectId: string;
  projectName: string;
  repoUrl: string;
  prUrl?: string | null;
  dependencyName: string;
  baselineVersion: string;
  targetVersion: string;
  stage: AnalysisStage;
  overallOutcome?: AnalysisOutcome | null;
  outcomeReason?: string | null;
  findingsCount: number;
  durationMs?: number | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface Finding {
  id: string;
  analysisId: string;
  title: string;
  symbol: string;
  changeCategory: ChangeCategory;
  severity: FindingSeverity;
  evidenceStrength: EvidenceStrength;
  dependencyName: string;
  baselineVersion: string;
  targetVersion: string;
  affectedFile: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  explanation: string;
  suggestedMigration?: string;
  verificationStatus: VerificationStatus;
  limitations: string[];
  linkedEvidenceIds: string[];
}

export interface Evidence {
  id: string;
  analysisId: string;
  type: string;
  source: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Execution {
  id: string;
  analysisId: string;
  phase: ExecutionPhase;
  checkType: string;
  command: string;
  status: CheckOutcome;
  exitCode: number | null;
  durationMs: number;
  stdoutExcerpt: string;
  stderrExcerpt: string;
  errorDetails?: string;
}

export interface AnalysisEvent {
  id: string;
  stage: AnalysisStage;
  message: string;
  data?: Record<string, any>;
  timestamp: string;
}

export interface PairedCheckComparison {
  checkType: string;
  command: string;
  baselineStatus: CheckOutcome;
  upgradeStatus: CheckOutcome;
  isRegression: boolean;
  inconclusiveReason?: string;
}

export interface AnalysisDetail {
  id: string;
  projectId: string;
  projectName: string;
  repoUrl: string;
  prUrl?: string | null;
  dependencyName: string;
  baselineVersion: string;
  targetVersion: string;
  baselineCommitSha: string;
  targetCommitSha?: string | null;
  lockfileHashBaseline?: string | null;
  lockfileHashUpgrade?: string | null;
  stage: AnalysisStage;
  overallOutcome?: AnalysisOutcome | null;
  outcomeReason?: string | null;
  runnerType: string;
  aiEnriched: boolean;
  aiModel?: string | null;
  errorDetails?: string | null;
  durationMs?: number | null;
  createdAt: string;
  completedAt?: string | null;
  findings: Finding[];
  evidenceList: Evidence[];
  executions: Execution[];
  events: AnalysisEvent[];
  reportSnapshot?: {
    comparisons: PairedCheckComparison[];
    limitations: string[];
  } | null;
}

export interface SystemSettings {
  status: string;
  version: string;
  runnerType: string;
  dockerAvailable: boolean;
  gitHubTokenConfigured: boolean;
  geminiConfigured: boolean;
  geminiModel: string;
  queueState: {
    type: string;
    activeWorkers: number;
    pendingJobs: number;
  };
  dbStatus: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg) as any;
    err.code = data?.code || 'REQUEST_FAILED';
    err.details = data?.details;
    err.status = res.status;
    throw err;
  }

  return data as T;
}

export const api = {
  // Auth
  register: (payload: { email: string; password: string; name: string }) =>
    request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  login: (payload: { email: string; password: string }) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  getMe: () =>
    request<{ user: User }>('/auth/me'),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean }>('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }),

  // Fixtures
  getFixtures: () =>
    request<{ scenarios: FixtureScenario[] }>('/fixtures'),

  // Analyses
  createFixtureAnalysis: (scenarioId: string) =>
    request<{ analysis: { id: string } }>('/analyses/fixture', {
      method: 'POST',
      body: JSON.stringify({ scenarioId })
    }),

  createPRAnalysis: (prUrl: string) =>
    request<{ analysis: { id: string } }>('/analyses/pr', {
      method: 'POST',
      body: JSON.stringify({ prUrl })
    }),

  createManualAnalysis: (payload: { repoUrl: string; dependencyName: string; targetVersion: string; baselineCommitSha?: string }) =>
    request<{ analysis: { id: string } }>('/analyses/manual', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  listAnalyses: (params: { page?: number; limit?: number; outcome?: string; stage?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.outcome) query.set('outcome', params.outcome);
    if (params.stage) query.set('stage', params.stage);
    if (params.search) query.set('search', params.search);
    return request<{ total: number; page: number; totalPages: number; analyses: AnalysisSummary[] }>(`/analyses?${query.toString()}`);
  },

  getAnalysis: (id: string) =>
    request<{ analysis: AnalysisDetail }>(`/analyses/${id}`),

  cancelAnalysis: (id: string) =>
    request<{ success: boolean }>(`/analyses/${id}/cancel`, { method: 'POST' }),

  rerunAnalysis: (id: string) =>
    request<{ analysis: { id: string } }>(`/analyses/${id}/rerun`, { method: 'POST' }),

  // System
  getSettings: () =>
    request<SystemSettings>('/system/settings')
};
