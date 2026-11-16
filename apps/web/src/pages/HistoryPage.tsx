import React, { useState, useEffect } from 'react';
import { api, type AnalysisSummary } from '../api';
import { OutcomeBadge } from '../components/OutcomeBadge';
import {
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  GitPullRequest,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';

interface Props {
  navigate: (route: string, param?: string) => void;
}

export const HistoryPage: React.FC<Props> = ({ navigate }) => {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.listAnalyses({
        page,
        limit: 12,
        search: search.trim() || undefined,
        outcome: outcomeFilter !== 'ALL' ? outcomeFilter : undefined,
        stage: stageFilter !== 'ALL' ? stageFilter : undefined
      });
      setAnalyses(res.analyses);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, outcomeFilter, stageFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analysis History</h1>
          <p className="mt-1 text-sm text-slate-600">
            Audit and inspect previous dependency verification runs and reproducible reports.
          </p>
        </div>

        <button
          onClick={() => navigate('new-analysis')}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm self-start sm:self-auto"
        >
          New Analysis
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <input
            type="text"
            placeholder="Search by dependency or repository..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={outcomeFilter}
              onChange={(e) => { setOutcomeFilter(e.target.value); setPage(1); }}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Outcomes</option>
              <option value="REGRESSION_OBSERVED">Regression Observed</option>
              <option value="POTENTIAL_IMPACT">Potential Impact</option>
              <option value="NO_REGRESSION_OBSERVED">No Regression</option>
              <option value="INCONCLUSIVE">Inconclusive</option>
            </select>
          </div>

          <select
            value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Stages</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="running">In Progress</option>
          </select>

          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <span>Loading history...</span>
          </div>
        ) : analyses.length === 0 ? (
          <div className="p-12 text-center">
            <GitPullRequest className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No analyses matched the criteria</h3>
            <p className="text-xs text-slate-500 mt-1">Try clearing filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Dependency Update</th>
                  <th className="px-4 py-3">Repository</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">Findings</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {analyses.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(a.stage === 'completed' ? 'report' : 'progress', a.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{a.dependencyName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {a.baselineVersion} → {a.targetVersion}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 truncate max-w-xs">
                      {a.projectName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        a.stage === 'completed' ? 'bg-slate-100 text-slate-700' :
                        a.stage === 'failed' ? 'bg-rose-100 text-rose-800' :
                        a.stage === 'cancelled' ? 'bg-slate-200 text-slate-600' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {a.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <OutcomeBadge outcome={a.overallOutcome} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.findingsCount > 0 ? (
                        <span className="font-bold text-rose-600">{a.findingsCount}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {a.durationMs ? `${(a.durationMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(a.stage === 'completed' ? 'report' : 'progress', a.id);
                        }}
                        className="text-emerald-600 hover:text-emerald-700 font-semibold text-xs inline-flex items-center gap-1"
                      >
                        <span>{a.stage === 'completed' ? 'Report' : 'Inspect'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing page <span className="font-bold text-slate-800">{page}</span> of{' '}
              <span className="font-bold text-slate-800">{totalPages}</span> ({total} total analyses)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};