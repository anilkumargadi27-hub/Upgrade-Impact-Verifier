import React from 'react';
import type { AnalysisOutcome } from '@upgradelens/contracts';
import { AlertTriangle, CheckCircle, HelpCircle, XCircle } from 'lucide-react';

interface Props {
  outcome?: AnalysisOutcome | null;
  className?: string;
  showIcon?: boolean;
}

export const OutcomeBadge: React.FC<Props> = ({ outcome, className = '', showIcon = true }) => {
  if (!outcome) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 ${className}`}>
        Pending
      </span>
    );
  }

  switch (outcome) {
    case 'REGRESSION_OBSERVED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 ${className}`}>
          {showIcon && <XCircle className="w-4 h-4 text-rose-600" />}
          REGRESSION OBSERVED
        </span>
      );
    case 'POTENTIAL_IMPACT':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 ${className}`}>
          {showIcon && <AlertTriangle className="w-4 h-4 text-amber-600" />}
          POTENTIAL IMPACT
        </span>
      );
    case 'NO_REGRESSION_OBSERVED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}>
          {showIcon && <CheckCircle className="w-4 h-4 text-emerald-600" />}
          NO REGRESSION OBSERVED
        </span>
      );
    case 'INCONCLUSIVE':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 ${className}`}>
          {showIcon && <HelpCircle className="w-4 h-4 text-slate-500" />}
          INCONCLUSIVE
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 ${className}`}>
          {outcome}
        </span>
      );
  }
};
