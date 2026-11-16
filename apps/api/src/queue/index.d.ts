import EventEmitter from 'events';
import type { AnalysisEvent } from '@upgradelens/contracts';
export interface AnalysisJobData {
    analysisId: string;
    userId: string;
    mode: 'pr' | 'manual' | 'fixture';
    prUrl?: string;
    repoUrl?: string;
    dependencyName?: string;
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
export declare const globalEventBus: EventEmitter<[never]>;
export declare function getQueueService(): IQueueService;
//# sourceMappingURL=index.d.ts.map