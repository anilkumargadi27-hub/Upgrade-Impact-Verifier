import { z } from 'zod';

// ==========================================
// Core Enums & Outcomes
// ==========================================

export const AnalysisOutcomeEnum = z.enum([
  'REGRESSION_OBSERVED',
  'POTENTIAL_IMPACT',
  'NO_REGRESSION_OBSERVED',
  'INCONCLUSIVE'
]);
export type AnalysisOutcome = z.infer<typeof AnalysisOutcomeEnum>;

export const AnalysisStageEnum = z.enum([
  'queued',
  'fetching',
  'validating',
  'extracting_changes',
  'scanning_usage',
  'preparing_runs',
  'running_baseline',
  'running_upgrade',
  'comparing',
  'generating_report',
  'completed',
  'failed',
  'cancelling',
  'cancelled'
]);
export type AnalysisStage = z.infer<typeof AnalysisStageEnum>;

export const FindingSeverityEnum = z.enum(['HIGH', 'MEDIUM', 'LOW', 'INFO']);
export type FindingSeverity = z.infer<typeof FindingSeverityEnum>;

export const EvidenceStrengthEnum = z.enum([
  'DEFINITIVE_REGRESSION',
  'OBSERVED_ERROR',
  'STATIC_ANALYSIS_WARNING',
  'DOC_MENTION'
]);
export type EvidenceStrength = z.infer<typeof EvidenceStrengthEnum>;

export const ChangeCategoryEnum = z.enum([
  'REMOVED_EXPORT',
  'SIGNATURE_CHANGED',
  'BEHAVIORAL_CHANGE',
  'TYPE_INCOMPATIBILITY',
  'DEPENDENCY_TRANSITIVE',
  'BUILD_CONFIGURATION'
]);
export type ChangeCategory = z.infer<typeof ChangeCategoryEnum>;

export const VerificationStatusEnum = z.enum([
  'VERIFIED_FAILING',
  'VERIFIED_PASSING',
  'UNEXECUTED',
  'INCONCLUSIVE'
]);
export type VerificationStatus = z.infer<typeof VerificationStatusEnum>;

export const EvidenceTypeEnum = z.enum([
  'RELEASE_NOTE',
  'API_DIFF',
  'AST_USAGE',
  'DIAGNOSTIC',
  'TEST_RESULT',
  'LOG_EXCERPT'
]);
export type EvidenceType = z.infer<typeof EvidenceTypeEnum>;

export const CheckTypeEnum = z.enum(['TEST', 'TYPECHECK', 'BUILD']);
export type CheckType = z.infer<typeof CheckTypeEnum>;

export const CheckOutcomeEnum = z.enum(['PASS', 'FAIL', 'SKIPPED', 'TIMEOUT', 'ERROR']);
export type CheckOutcome = z.infer<typeof CheckOutcomeEnum>;

export const ExecutionPhaseEnum = z.enum(['BASELINE', 'UPGRADE']);
export type ExecutionPhase = z.infer<typeof ExecutionPhaseEnum>;

// ==========================================
// Authentication Schemas
// ==========================================

export const RegisterRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long')
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long')
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  createdAt: z.string()
});
export type UserResponse = z.infer<typeof UserResponseSchema>;

// ==========================================
// Project & Analysis Schemas
// ==========================================

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  repoUrl: z.string(),
  defaultBranch: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateAnalysisPRRequestSchema = z.object({
  prUrl: z.string().url('Must be a valid URL').regex(/github\.com\/[^/]+\/[^/]+\/pull\/\d+/, 'Must be a valid GitHub Pull Request URL')
});
export type CreateAnalysisPRRequest = z.infer<typeof CreateAnalysisPRRequestSchema>;

export const CreateAnalysisManualRequestSchema = z.object({
  repoUrl: z.string().url('Must be a valid URL').regex(/github\.com\/[^/]+\/[^/]+/, 'Must be a valid GitHub repository URL'),
  dependencyName: z.string().min(1, 'Dependency name is required'),
  targetVersion: z.string().min(1, 'Target version is required'),
  baselineCommitSha: z.string().optional()
});
export type CreateAnalysisManualRequest = z.infer<typeof CreateAnalysisManualRequestSchema>;

export const CreateAnalysisFixtureRequestSchema = z.object({
  scenarioId: z.string().min(1, 'Scenario ID is required')
});
export type CreateAnalysisFixtureRequest = z.infer<typeof CreateAnalysisFixtureRequestSchema>;

// Evidence Schema
export const EvidenceSchema = z.object({
  id: z.string(),
  analysisId: z.string(),
  type: EvidenceTypeEnum,
  source: z.string(),
  title: z.string(),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string()
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// Finding Schema
export const FindingSchema = z.object({
  id: z.string(),
  analysisId: z.string(),
  title: z.string(),
  symbol: z.string(),
  changeCategory: ChangeCategoryEnum,
  severity: FindingSeverityEnum,
  evidenceStrength: EvidenceStrengthEnum,
  dependencyName: z.string(),
  baselineVersion: z.string(),
  targetVersion: z.string(),
  affectedFile: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int(),
  codeSnippet: z.string(),
  explanation: z.string(),
  suggestedMigration: z.string().optional(),
  verificationStatus: VerificationStatusEnum,
  limitations: z.array(z.string()).default([]),
  linkedEvidenceIds: z.array(z.string()).default([]),
  createdAt: z.string()
});
export type Finding = z.infer<typeof FindingSchema>;

// Execution Schema
export const ExecutionSchema = z.object({
  id: z.string(),
  analysisId: z.string(),
  phase: ExecutionPhaseEnum,
  checkType: CheckTypeEnum,
  command: z.string(),
  status: CheckOutcomeEnum,
  exitCode: z.number().nullable(),
  durationMs: z.number(),
  stdoutExcerpt: z.string(),
  stderrExcerpt: z.string(),
  errorDetails: z.string().optional(),
  createdAt: z.string()
});
export type Execution = z.infer<typeof ExecutionSchema>;

// Analysis Event Schema (for SSE)
export const AnalysisEventSchema = z.object({
  id: z.string(),
  analysisId: z.string(),
  stage: AnalysisStageEnum,
  message: z.string(),
  timestamp: z.string(),
  data: z.record(z.any()).optional()
});
export type AnalysisEvent = z.infer<typeof AnalysisEventSchema>;

// Paired Check Comparison Schema
export const PairedCheckComparisonSchema = z.object({
  checkType: CheckTypeEnum,
  command: z.string(),
  baselineStatus: CheckOutcomeEnum,
  upgradeStatus: CheckOutcomeEnum,
  isRegression: z.boolean(),
  inconclusiveReason: z.string().optional(),
  baselineExecutionId: z.string().optional(),
  upgradeExecutionId: z.string().optional()
});
export type PairedCheckComparison = z.infer<typeof PairedCheckComparisonSchema>;

// Queue and Job Types
export interface AnalysisJobData {
  analysisId: string;
  userId: string;
  mode: 'pr' | 'manual' | 'fixture';
  prUrl?: string;
  repoUrl?: string;
  dependencyName?: string;
  baselineVersion?: string;
  targetVersion?: string;
  baselineCommitSha?: string;
  scenarioId?: string;
  attemptNumber: number;
}

export interface IQueueService {
  enqueueJob(data: AnalysisJobData): Promise<void>;
  cancelJob(analysisId: string): Promise<boolean>;
  publishEvent(event: AnalysisEvent): Promise<void>;
  onEvent(analysisId: string, handler: (event: AnalysisEvent) => void): () => void;
  getActiveWorkerCount(): number;
  getPendingJobCount(): Promise<number>;
}
export const AnalysisReportSchema = z.object({
  analysisId: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  repoUrl: z.string(),
  prUrl: z.string().nullable().optional(),
  baselineCommitSha: z.string(),
  targetCommitSha: z.string().nullable().optional(),
  dependencyName: z.string(),
  baselineVersion: z.string(),
  targetVersion: z.string(),
  lockfileHashBaseline: z.string(),
  lockfileHashUpgrade: z.string(),
  transitiveChanges: z.array(z.object({
    name: z.string(),
    fromVersion: z.string(),
    toVersion: z.string(),
    action: z.enum(['ADDED', 'REMOVED', 'UPDATED'])
  })).default([]),
  overallOutcome: AnalysisOutcomeEnum,
  outcomeReason: z.string(),
  findings: z.array(FindingSchema),
  evidenceList: z.array(EvidenceSchema),
  executions: z.array(ExecutionSchema),
  comparisons: z.array(PairedCheckComparisonSchema),
  aiEnriched: z.boolean(),
  aiModel: z.string().nullable().optional(),
  limitations: z.array(z.string()).default([]),
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),
  runnerType: z.string()
});
export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;

// Analysis Overview Schema
export const AnalysisOverviewSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  repoUrl: z.string(),
  prUrl: z.string().nullable().optional(),
  dependencyName: z.string(),
  baselineVersion: z.string(),
  targetVersion: z.string(),
  stage: AnalysisStageEnum,
  overallOutcome: AnalysisOutcomeEnum.nullable().optional(),
  findingsCount: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable().optional()
});
export type AnalysisOverview = z.infer<typeof AnalysisOverviewSchema>;

// System Status / Settings Info Schema
export const SystemHealthSchema = z.object({
  status: z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY']),
  version: z.string(),
  runnerType: z.string(),
  dockerAvailable: z.boolean(),
  gitHubTokenConfigured: z.boolean(),
  geminiConfigured: z.boolean(),
  geminiModel: z.string().nullable(),
  queueState: z.object({
    type: z.enum(['BULLMQ_REDIS', 'IN_PROCESS']),
    activeWorkers: z.number(),
    pendingJobs: z.number()
  }),
  dbStatus: z.enum(['CONNECTED', 'DISCONNECTED'])
});
export type SystemHealth = z.infer<typeof SystemHealthSchema>;
