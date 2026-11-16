import React, { useState, useEffect, useRef } from 'react';
import { api, type AnalysisDetail, type AnalysisEvent } from '../api';
import { StageProgress } from '../components/StageProgress';
import { OutcomeBadge } from '../components/OutcomeBadge';
import {
  ArrowRight,
  RefreshCw,
  XCircle,
  AlertCircle,
  Clock,
  Terminal,
  StopCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface Props {
  analysisId: string;
  navigate: (route: string, param?: string) => void;
}

export const ProgressPage: React.FC<Props> = ({ analysisId, navigate }) => {
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [events, setEvents] = useState<AnalysisEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Initial load
  const loadInitial = async () => {
    try {
      const res = await api.getAnalysis(analysisId);
      setAnalysis(res.analysis);
      setEvents(res.analysis.events || []);
      if (res.analysis.stage === 'completed') {
        // Already completed
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analysis details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, [analysisId]);

  // Connect to live SSE stream
  useEffect(() => {
    if (!analysisId) return;

    const eventSource = new EventSource(`/api/analyses/${analysisId}/events`);

    eventSource.onopen = () => {
      setSseConnected(true);
    };

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'stage_changed' || payload.type === 'progress') {
          setAnalysis(prev => prev ? {
            ...prev,
            stage: payload.stage,
            overallOutcome: payload.overallOutcome || prev.overallOutcome
          } : null);

          setEvents(prev => [
            ...prev,
            {
              id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              stage: payload.stage,
              message: payload.message || `Stage updated to ${payload.stage}`,
              timestamp: payload.timestamp || new Date().toISOString()
            }
          ]);
        } else if (payload.type === 'completed') {
          setAnalysis(prev => prev ? {
            ...prev,
            stage: 'completed',
            overallOutcome: payload.overallOutcome,
            outcomeReason: payload.outcomeReason
          } : null);
          eventSource.close();
        } else if (payload.type === 'failed') {
          setAnalysis(prev => prev ? {
            ...prev,
            stage: 'failed',
            errorDetails: payload.error
          } : null);
          eventSource.close();
        } else if (payload.type === 'cancelled') {
          setAnalysis(prev => prev ? {
            ...prev,
            stage: 'cancelled'
          } : null);
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      setSseConnected(false);
      eventSource.close();
    };

    // Polling fallback every 3 seconds if not completed
    const interval = setInterval(async () => {
      try {
        const res = await api.getAnalysis(analysisId);
        setAnalysis(res.analysis);
        if (res.analysis.events && res.analysis.events.length > events.length) {
          setEvents(res.analysis.events);
        }
        if (['completed', 'failed', 'cancelled'].includes(res.analysis.stage)) {
          clearInterval(interval);
        }
      } catch {
        // ignore background poll error
      }
    }, 3000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, [analysisId]);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this analysis?')) return;
    setCancelling(true);
    try {
      await api.cancelAnalysis(analysisId);
      setAnalysis(prev => prev ? { ...prev, stage: 'cancelled' } : null);
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  const handleRerun = async () => {
    setRerunning(true);
    try {
      const res = await api.rerunAnalysis(analysisId);
      navigate('progress', res.analysis.id);
    } catch (err: any) {
      alert(`Rerun failed: ${err.message}`);
    } finally {
      setRerunning(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-3" />
        <h2 className="text-base font-semibold text-slate-800">Connecting to Verification Worker...</h2>
        <p className="text-xs text-slate-500 mt-1">Initializing event stream and checking job status</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Analysis Not Found or Inaccessible</h2>
        <p className="text-xs text-slate-600 mt-1">{error || 'The requested analysis could not be retrieved.'}</p>
        <button
          onClick={() => navigate('dashboard')}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  }

  const isCompleted = analysis.stage === 'completed';
  const isFailed = analysis.stage === 'failed';
  const isCancelled = analysis.stage === 'cancelled';
  const isRunning = !isCompleted && !isFailed && !isCancelled;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <span>{analysis.dependencyName}</span>
            <span className="text-base font-mono font-normal text-slate-500">
              {analysis.baselineVersion} → {analysis.targetVersion}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Repository: <span className="font-mono text-slate-700">{analysis.projectName}</span>
            {analysis.prUrl && (
              <span className="ml-2 font-mono text-emerald-700">({analysis.prUrl})</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isRunning && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <StopCircle className="w-4 h-4 text-rose-600" />
              <span>{cancelling ? 'Cancelling...' : 'Cancel Run'}</span>
            </button>
          )}

          {(isFailed || isCancelled) && (
            <button
              onClick={handleRerun}
              disabled={rerunning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rerunning ? 'animate-spin' : ''}`} />
              <span>Rerun Analysis</span>
            </button>
          )}

          {isCompleted && (
            <button
              onClick={() => navigate('report', analysis.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm transition-colors"
            >
              <span>View Verified Report</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Completion Banner */}
      {isCompleted && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Analysis Pipeline Completed</span>
                <OutcomeBadge outcome={analysis.overallOutcome} />
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                {analysis.outcomeReason || 'All comparative checks and AST scans have finalized.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('report', analysis.id)}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>Examine Full Report</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Failure Banner */}
      {isFailed && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm block">Analysis Terminated with Error</span>
            <p className="text-xs text-rose-800 mt-1 font-mono bg-white/70 p-2 rounded border border-rose-200">
              {analysis.errorDetails || 'An unhandled exception occurred during workspace execution.'}
            </p>
          </div>
        </div>
      )}

      {/* Stage Progress Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pipeline Stages</h2>
            <span className="text-[11px] font-semibold text-slate-500">
              ({analysis.stage.replace('_', ' ')})
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className={`inline-block w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span>{sseConnected ? 'Live SSE Connected' : 'Polling Sync'}</span>
          </div>
        </div>
        <StageProgress currentStage={analysis.stage} />
      </div>

      {/* Real-Time Live Execution Log Terminal */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-md overflow-hidden">
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-mono font-semibold text-slate-200">Execution Events & Audit Trail</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {events.length} events logged
          </span>
        </div>

        <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs space-y-2 select-text">
          {events.length === 0 ? (
            <div className="text-slate-600 text-center py-8">
              Waiting for initial orchestrator event...
            </div>
          ) : (
            events.map((evt, idx) => (
              <div key={evt.id || idx} className="flex items-start gap-3 text-slate-300 leading-relaxed hover:bg-slate-900/50 p-1 rounded">
                <span className="text-slate-600 text-[11px] select-none flex-shrink-0">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-400 flex-shrink-0">
                  {evt.stage}
                </span>
                <span className="text-slate-200 break-all">{evt.message}</span>
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};