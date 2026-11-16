import React, { useState, useEffect } from 'react';
import { api, type FixtureScenario } from '../api';
import {
  GitPullRequest,
  Package,
  Layers,
  AlertCircle,
  Play,
  Info,
  CheckCircle2,
  ArrowRight,
  Loader2
} from 'lucide-react';

interface Props {
  navigate: (route: string, param?: string) => void;
}

export const NewAnalysisPage: React.FC<Props> = ({ navigate }) => {
  const [activeTab, setActiveTab] = useState<'pr' | 'manual' | 'fixtures'>('pr');
  
  // PR mode
  const [prUrl, setPrUrl] = useState('');
  
  // Manual mode
  const [repoUrl, setRepoUrl] = useState('');
  const [dependencyName, setDependencyName] = useState('');
  const [targetVersion, setTargetVersion] = useState('');
  const [baselineCommitSha, setBaselineCommitSha] = useState('');

  // Fixtures
  const [fixtures, setFixtures] = useState<FixtureScenario[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingFixtures(true);
    api.getFixtures()
      .then(res => setFixtures(res.scenarios))
      .catch(err => console.error('Failed to load fixtures:', err))
      .finally(() => setLoadingFixtures(false));
  }, []);

  const handlePrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!prUrl.trim()) {
      setError('Please provide a valid GitHub Pull Request URL.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createPRAnalysis(prUrl.trim());
      navigate('progress', res.analysis.id);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize PR analysis.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!repoUrl.trim() || !dependencyName.trim() || !targetVersion.trim()) {
      setError('Repository URL, dependency name, and target version are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createManualAnalysis({
        repoUrl: repoUrl.trim(),
        dependencyName: dependencyName.trim(),
        targetVersion: targetVersion.trim(),
        baselineCommitSha: baselineCommitSha.trim() || undefined
      });
      navigate('progress', res.analysis.id);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize manual analysis.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLaunchFixture = async (scenarioId: string) => {
    setLaunchingId(scenarioId);
    setError(null);
    try {
      const res = await api.createFixtureAnalysis(scenarioId);
      navigate('progress', res.analysis.id);
    } catch (err: any) {
      setError(err.message || 'Failed to launch fixture scenario.');
    } finally {
      setLaunchingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Start New Impact Analysis
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Verify dependency upgrade compatibility using source AST scanning and paired baseline/upgrade workspace check executions.
        </p>
      </div>

      {/* Scope and Boundary Contract Notification */}
      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 text-xs text-blue-900 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-blue-950">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>Supported Scope & Operational Boundaries</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px] leading-relaxed">
          <div>
            <span className="font-semibold text-blue-950 block mb-0.5">Supported:</span>
            <ul className="list-disc pl-4 space-y-0.5 text-blue-800">
              <li>Public GitHub repositories (JavaScript & TypeScript)</li>
              <li>Single root package with valid <code className="bg-blue-100 px-1 rounded">package-lock.json</code></li>
              <li>1 direct dependency upgrade per pull request</li>
              <li>Standard npm registry packages</li>
            </ul>
          </div>
          <div>
            <span className="font-semibold text-blue-950 block mb-0.5">Unsupported / Rejected:</span>
            <ul className="list-disc pl-4 space-y-0.5 text-blue-800">
              <li>Private repositories or unauthorized tokens</li>
              <li>Monorepos, pnpm, yarn, or bun workspaces</li>
              <li>PRs with multiple dependency changes or manual source changes</li>
              <li>Git / local-path / URL dependencies</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Analysis Initialization Failed</span>
            <span className="mt-0.5 block">{error}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => { setActiveTab('pr'); setError(null); }}
            className={`flex-1 py-3.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'pr'
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitPullRequest className="w-4 h-4 text-emerald-600" />
            <span>GitHub Pull Request</span>
          </button>
          <button
            onClick={() => { setActiveTab('manual'); setError(null); }}
            className={`flex-1 py-3.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'manual'
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-600" />
            <span>Manual Upgrade Specification</span>
          </button>
          <button
            onClick={() => { setActiveTab('fixtures'); setError(null); }}
            className={`flex-1 py-3.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'fixtures'
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Built-in Fixture Demonstrations</span>
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
              8 Real Scenarios
            </span>
          </button>
        </div>

        <div className="p-6">
          {/* PR Tab */}
          {activeTab === 'pr' && (
            <form onSubmit={handlePrSubmit} className="space-y-5 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  GitHub Pull Request URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    required
                    placeholder="https://github.com/owner/repository/pull/123"
                    value={prUrl}
                    onChange={(e) => setPrUrl(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <GitPullRequest className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  UpgradeLens will inspect the PR diff, confirm a single direct dependency upgrade, extract baseline/target versions, and clone the baseline repo.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Ingesting PR & Queuing...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze Pull Request</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Manual Tab */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Public GitHub Repository URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/owner/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Dependency Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. date-fns, axios, lodash"
                    value={dependencyName}
                    onChange={(e) => setDependencyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Exact Target Version
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3.0.0"
                    value={targetVersion}
                    onChange={(e) => setTargetVersion(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Baseline Commit SHA <span className="text-slate-400 font-normal">(Optional, defaults to default branch HEAD)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7a8f9b2c..."
                  value={baselineCommitSha}
                  onChange={(e) => setBaselineCommitSha(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating & Queuing...</span>
                    </>
                  ) : (
                    <>
                      <span>Queue Manual Analysis</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Fixtures Tab */}
          {activeTab === 'fixtures' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pre-Packaged Ground-Truth Test Scenarios
                  </h3>
                  <p className="text-xs text-slate-500">
                    Each scenario executes through the complete live analyzer, runner, and persistence pipeline.
                  </p>
                </div>
              </div>

              {loadingFixtures ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  <span>Loading scenarios...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fixtures.map((f) => (
                    <div
                      key={f.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono font-bold text-slate-700">{f.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                            f.expectedOutcome === 'REGRESSION_OBSERVED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : f.expectedOutcome === 'POTENTIAL_IMPACT'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : f.expectedOutcome === 'NO_REGRESSION_OBSERVED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {f.expectedOutcome.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{f.name}</h4>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{f.description}</p>
                        
                        <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-2 rounded border border-slate-200">
                          <span className="text-slate-400">Dependency: </span>
                          <span className="text-slate-800 font-semibold">{f.dependencyName}</span>{' '}
                          <span className="text-slate-500">({f.baselineVersion} → {f.targetVersion})</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleLaunchFixture(f.id)}
                        disabled={launchingId === f.id}
                        className="mt-4 w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                      >
                        {launchingId === f.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                            <span>Launching Pipeline...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                            <span>Run Verification Pipeline</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};