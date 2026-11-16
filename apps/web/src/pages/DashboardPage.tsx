import React, { useState, useEffect } from 'react';
import { api, type AnalysisSummary, type FixtureScenario } from '../api';
import { OutcomeBadge } from '../components/OutcomeBadge';
import {
  Plus,
  Play,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  GitPullRequest
} from 'lucide-react';

interface Props {
  navigate: (route: string, param?: string) => void;
}

export const DashboardPage: React.FC<Props> = ({ navigate }) => {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [fixtures, setFixtures] = useState<FixtureScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const [analysesRes, fixturesRes] = await Promise.all([
        api.listAnalyses({ limit: 15, outcome: outcomeFilter !== 'ALL' ? outcomeFilter : undefined }),
        api.getFixtures()
      ]);
      setAnalyses(analysesRes.analyses);
      setFixtures(fixturesRes.scenarios);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [outcomeFilter]);

  const handleLaunchFixture = async (scenarioId: string) => {
    setLaunchingId(scenarioId);
    try {
      const res = await api.createFixtureAnalysis(scenarioId);
      navigate('progress', res.analysis.id);
    } catch (err: any) {
      alert(`Failed to launch fixture: ${err.message}`);
    } finally {
      setLaunchingId(null);
    }
  };

  // Real analysis counts
  const regressionCount = analyses.filter(a => a.overallOutcome === 'REGRESSION_OBSERVED').length;
  const potentialCount = analyses.filter(a => a.overallOutcome === 'POTENTIAL_IMPACT').length;
  const safeCount = analyses.filter(a => a.overallOutcome === 'NO_REGRESSION_OBSERVED').length;
  const inconclusiveCount = analyses.filter(a => a.overallOutcome === 'INCONCLUSIVE').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            UpgradeLens Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Answers: <span className="font-semibold text-slate-800">“If I upgrade this dependency, which parts of my application could break, and what evidence supports that conclusion?”</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('new-analysis')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Analysis</span>
          </button>
        </div>
      </div>

      {/* Real Outcome Metrics (No fabricated data) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Regressions</span>
            <ShieldCheck className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600">{regressionCount}</span>
            <span className="text-xs text-slate-500">observed</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Potential Impact</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{potentialCount}</span>
            <span className="text-xs text-slate-500">API usages</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">No Regression</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{safeCount}</span>
            <span className="text-xs text-slate-500">checks passing</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inconclusive</span>
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-700">{inconclusiveCount}</span>
            <span className="text-xs text-slate-500">baseline/limits</span>
          </div>
        </div>
      </div>

      {/* Built-in Fixture Demonstrations (Section 9: Clearly labeled fixture demonstration action) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Interactive Fixture Demonstrations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Launch real end-to-end verification pipelines against pre-packaged baseline and upgrade test scenarios.
            </p>
          </div>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            Real Pipeline
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {fixtures.slice(0, 4).map((f) => (
            <div
              key={f.id}
              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono font-semibold text-slate-600">{f.id}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                    {f.expectedOutcome.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-slate-900 line-clamp-1">{f.name}</h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{f.description}</p>
              </div>

              <button
                onClick={() => handleLaunchFixture(f.id)}
                disabled={launchingId === f.id}
                className="mt-3 w-full py-1.5 px-2.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
              >
                <Play className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                <span>{launchingId === f.id ? 'Queuing...' : 'Run Pipeline'}</span>
              </button>
            </div>
          ))}
        </div>

        {fixtures.length > 4 && (
          <div className="mt-3 text-right">
            <button
              onClick={() => navigate('new-analysis')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
            >
              <span>View all {fixtures.length} scenarios</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Recent Analyses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Analyses</h2>
            <p className="text-xs text-slate-500">Live and historical dependency upgrade impact reports</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Outcomes</option>
              <option value="REGRESSION_OBSERVED">Regression Observed</option>
              <option value="POTENTIAL_IMPACT">Potential Impact</option>
              <option value="NO_REGRESSION_OBSERVED">No Regression</option>
              <option value="INCONCLUSIVE">Inconclusive</option>
            </select>
            <button
              onClick={loadData}
              title="Refresh analyses"
              className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading analyses...</div>
        ) : analyses.length === 0 ? (
          <div className="p-12 text-center">
            <GitPullRequest className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No analyses found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Submit a GitHub Pull Request URL or launch an interactive fixture scenario above to verify dependency upgrade impacts.
            </p>
            <button
              onClick={() => navigate('new-analysis')}
              className="mt-4 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              Start First Analysis
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Dependency Update</th>
                  <th className="px-4 py-3">Repository / Source</th>
                  <th className="px-4 py-3">Stage / Status</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">Findings</th>
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
                    <td className="px-4 py-3">
                      <div className="text-slate-700 truncate max-w-xs">{a.projectName}</div>
                      {a.prUrl && (
                        <div className="text-[10px] text-emerald-600 truncate max-w-xs">PR #{a.prUrl.split('/').pop()}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        a.stage === 'completed' ? 'bg-slate-100 text-slate-700' :
                        a.stage === 'failed' ? 'bg-rose-100 text-rose-800' :
                        a.stage === 'cancelled' ? 'bg-slate-200 text-slate-700' :
                        'bg-blue-50 text-blue-700 animate-pulse'
                      }`}>
                        {a.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <OutcomeBadge outcome={a.overallOutcome} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.findingsCount > 0 ? (
                        <span className="font-semibold text-rose-600">{a.findingsCount} findings</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
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
                        <span>{a.stage === 'completed' ? 'View Report' : 'Inspect'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
