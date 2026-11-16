import React from 'react';
import type { AnalysisStage } from '@upgradelens/contracts';
import { Check, Loader2, X } from 'lucide-react';

interface Props {
  currentStage: AnalysisStage;
  error?: string | null;
}

const STAGES: Array<{ key: AnalysisStage; label: string }> = [
  { key: 'queued', label: 'Queued' },
  { key: 'fetching', label: 'Fetching' },
  { key: 'validating', label: 'Validating' },
  { key: 'extracting_changes', label: 'Extracting Changes' },
  { key: 'scanning_usage', label: 'Scanning AST Usage' },
  { key: 'preparing_runs', label: 'Preparing Workspaces' },
  { key: 'running_baseline', label: 'Baseline Checks' },
  { key: 'running_upgrade', label: 'Upgrade Checks' },
  { key: 'comparing', label: 'Comparing Results' },
  { key: 'completed', label: 'Report Generated' }
];

export const StageProgress: React.FC<Props> = ({ currentStage }) => {
  const isFailed = currentStage === 'failed';
  const isCancelled = currentStage === 'cancelled';
  const isTerminated = isFailed || isCancelled;

  const stageKeys = STAGES.map(s => s.key);
  const currentIndex = stageKeys.indexOf(currentStage);

  return (
    <div className="w-full py-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STAGES.map((s, idx) => {
          let status: 'completed' | 'active' | 'pending' | 'failed' | 'cancelled' = 'pending';

          if (isFailed && idx === currentIndex) {
            status = 'failed';
          } else if (isCancelled && idx === currentIndex) {
            status = 'cancelled';
          } else if (currentStage === 'completed' || idx < currentIndex) {
            status = 'completed';
          } else if (idx === currentIndex) {
            status = 'active';
          }

          return (
            <div
              key={s.key}
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                status === 'completed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : status === 'active'
                  ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-100'
                  : status === 'failed'
                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                  : status === 'cancelled'
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              <div className="flex-shrink-0">
                {status === 'completed' && <Check className="w-4 h-4 text-emerald-600" />}
                {status === 'active' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                {status === 'failed' && <X className="w-4 h-4 text-rose-600" />}
                {status === 'cancelled' && <X className="w-4 h-4 text-slate-500" />}
                {status === 'pending' && <span className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-500">{idx + 1}</span>}
              </div>
              <span className="truncate">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
