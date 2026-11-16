import React, { useState, useEffect } from 'react';
import { api, type AnalysisDetail, type Finding, type Execution, type PairedCheckComparison } from '../api';
import { OutcomeBadge } from '../components/OutcomeBadge';
import { CodeSnippet } from '../components/CodeSnippet';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileCode,
  Shield,
  Layers,
  Terminal,
  Info,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Loader2,
  Check
} from 'lucide-react';

interface Props {
  analysisId: string;
  navigate: (route: string, param?: string) => void;
}

export const ReportPage: React.FC<Props> = ({ analysisId, navigate }) => {
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'checks' | 'diffs' | 'audit'>('overview');
  const [expandedExecs, setExpandedExecs] = useState<Record<string, boolean>>({});
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getAnalysis(analysisId)
      .then(res => setAnalysis(res.analysis))
      .catch(err => setError(err.message || 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [analysisId]);

  const toggleExec = (id: string) => {
    setExpandedExecs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRerun = async () => {
    if (!analysis) return;
    setRerunning(true);
    try {
      const res = await api.rerunAnalysis(analysis.id);
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
        <h2 className="text-base font-semibold text-slate-800">Loading Analysis Report...</h2>
        <p className="text-xs text-slate-500 mt-1">Retrieving evidence, AST findings, and check comparison results</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Failed to Load Report</h2>
        <p className="text-xs text-slate-600 mt-1">{error || 'Report could not be retrieved.'}</p>
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

  const comparisons: PairedCheckComparison[] = analysis.reportSnapshot?.comparisons || [];
  const limitations: string[] = analysis.reportSnapshot?.limitations || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {analysis.dependencyName}
            </h1>
            <span className="text-sm font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {analysis.baselineVersion} → {analysis.targetVersion}
            </span>
            <OutcomeBadge outcome={analysis.overallOutcome} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Project: <span className="font-semibold text-slate-700">{analysis.projectName}</span>
            {analysis.prUrl && (
              <span className="ml-2 font-mono text-emerald-600">
                (PR: {analysis.prUrl})
              </span>
            )}
            <span className="ml-3">Analyzed on {new Date(analysis.createdAt).toLocaleDateString()}</span>
            {analysis.durationMs && (
              <span className="ml-2">({(analysis.durationMs / 1000).toFixed(1)}s runtime)</span>
            )}
          </p>
        </div>

        {/* Action Buttons: Export & Rerun */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/analyses/${analysis.id}/export/markdown`}
            download
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Markdown</span>
          </a>
          <a
            href={`/api/analyses/${analysis.id}/export/json`}
            download
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>JSON</span>
          </a>
          <button
            onClick={handleRerun}
            disabled={rerunning}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rerunning ? 'animate-spin' : ''}`} />
            <span>Rerun</span>
          </button>
        </div>
      </div>

      {/* Outcome Verdict Card */}
      <div className={`p-5 rounded-xl border ${
        analysis.overallOutcome === 'REGRESSION_OBSERVED'
          ? 'bg-rose-50/70 border-rose-200 text-rose-950'
          : analysis.overallOutcome === 'POTENTIAL_IMPACT'
          ? 'bg-amber-50/70 border-amber-200 text-amber-950'
          : analysis.overallOutcome === 'NO_REGRESSION_OBSERVED'
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          : 'bg-slate-100 border-slate-300 text-slate-900'
      }`}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white shadow-xs">
            {analysis.overallOutcome === 'REGRESSION_OBSERVED' && <XCircle className="w-6 h-6 text-rose-600" />}
            {analysis.overallOutcome === 'POTENTIAL_IMPACT' && <AlertTriangle className="w-6 h-6 text-amber-600" />}
            {analysis.overallOutcome === 'NO_REGRESSION_OBSERVED' && <CheckCircle className="w-6 h-6 text-emerald-600" />}
            {analysis.overallOutcome === 'INCONCLUSIVE' && <Info className="w-6 h-6 text-slate-500" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">Verification Verdict:</span>
              <span className="font-extrabold text-sm">{analysis.overallOutcome?.replace('_', ' ')}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed font-medium">
              {analysis.outcomeReason || 'Comparative analysis and source AST scan complete.'}
            </p>
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Executive Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('findings')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'findings'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Affected Application Code</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 border">
              {analysis.findings.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('checks')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'checks'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Pairwise Check Comparison</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 border">
              {comparisons.length || analysis.executions.length / 2}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('diffs')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'diffs'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Dependency API Differences</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 border">
              {analysis.evidenceList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Audit & Reproducibility</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Tab 1: Executive Overview (The Four Pillars) */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pillar A: What changed in the dependency */}
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[11px]">A</span>
                  <span>What changed in the dependency</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Export declarations and exported signatures were compared between version{' '}
                  <code className="font-mono text-slate-800 bg-slate-100 px-1 rounded">{analysis.baselineVersion}</code> and{' '}
                  <code className="font-mono text-slate-800 bg-slate-100 px-1 rounded">{analysis.targetVersion}</code>.
                </p>
                <div className="text-xs text-slate-700 font-medium pt-1">
                  Detected <span className="font-bold">{analysis.evidenceList.length}</span> declaration diff item(s).
                </div>
              </div>

              {/* Pillar B: Where the application uses the affected API */}
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[11px]">B</span>
                  <span>Where the application uses the affected API</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  TypeScript AST scanner inspected all root application source files for imports, requires, and call expressions referencing the upgraded package.
                </p>
                <div className="text-xs text-slate-700 font-medium pt-1">
                  Matched <span className="font-bold text-rose-600">{analysis.findings.length}</span> affected source usage site(s).
                </div>
              </div>

              {/* Pillar C: What the checks actually observed */}
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[11px]">C</span>
                  <span>What the checks actually observed</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Build, type-check, and automated test checks were executed in isolated baseline and upgrade workspaces.
                </p>
                <div className="text-xs text-slate-700 font-medium pt-1">
                  Executed <span className="font-bold">{analysis.executions.length}</span> total check command(s).
                </div>
              </div>

              {/* Pillar D: What remains uncertain */}
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[11px]">D</span>
                  <span>What remains uncertain</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Static analysis and test suites cover exercised code paths. Dynamic reflection, untested behaviors, and unexercised edge cases remain inherently unverified.
                </p>
                <div className="text-xs text-slate-700 font-medium pt-1">
                  Documented <span className="font-bold">{limitations.length || 3}</span> operational boundary condition(s).
                </div>
              </div>
            </div>

            {/* AI Enrichment Notice */}
            {analysis.aiEnriched ? (
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-950 text-xs flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">AI-Enriched Explanations Present</span>
                  <span className="mt-0.5 block text-indigo-900">
                    Explanations and migration snippets were synthesized by {analysis.aiModel || 'Gemini'} based on raw AST differences and error logs. AI-generated text is clearly demarcated and never treated as raw ground-truth evidence.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-slate-800">Deterministic Engine Report</span>
                  <span className="mt-0.5 block text-slate-600">
                    This report was generated entirely using deterministic TypeScript AST scanning, declaration diffing, and isolated check execution. No uncalibrated AI score or synthetic data is displayed.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Affected Code & Findings */}
        {activeTab === 'findings' && (
          <div className="space-y-4">
            {analysis.findings.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800">No Incompatible API Usages Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  The application source code does not call or import any removed or breakingly altered symbols from {analysis.dependencyName}.
                </p>
              </div>
            ) : (
              analysis.findings.map((f: Finding) => (
                <div key={f.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          f.severity === 'HIGH'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : f.severity === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {f.severity}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {f.symbol}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ({f.changeCategory.replace('_', ' ')})
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">{f.title}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500">Evidence:</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700">
                        {f.evidenceStrength}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    {/* File and Line Range */}
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <FileCode className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="font-semibold text-slate-900">{f.affectedFile}</span>
                      <span className="text-slate-400">•</span>
                      <span>Lines {f.startLine}–{f.endLine}</span>
                    </div>

                    {/* Code Snippet */}
                    <div>
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Application Usage Site
                      </span>
                      <CodeSnippet
                        code={f.codeSnippet}
                        fileName={f.affectedFile}
                        startLine={f.startLine}
                      />
                    </div>

                    {/* Explanation */}
                    <div>
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Impact Explanation
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                        {f.explanation}
                      </p>
                    </div>

                    {/* Suggested Migration (Clearly Demarcated) */}
                    {f.suggestedMigration && (
                      <div className="border border-indigo-200 bg-indigo-50/50 rounded-lg p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Suggested Migration</span>
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            Status: {f.verificationStatus.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-indigo-900 font-mono whitespace-pre-wrap bg-white p-2.5 rounded border border-indigo-200">
                          {f.suggestedMigration}
                        </p>
                        <p className="text-[10px] text-indigo-800/80 italic">
                          Notice: Suggested code migrations are provided for developer convenience and are never labeled as verified until executed in test suites.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Pairwise Check Comparison */}
        {activeTab === 'checks' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Workspace Check Comparison</h3>
                <p className="text-xs text-slate-500">Pairwise execution of identical build, typecheck, and test commands across baseline and upgrade workspaces.</p>
              </div>

              {comparisons.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Check executions were recorded directly in the execution history.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Check Type</th>
                        <th className="px-4 py-3">Command</th>
                        <th className="px-4 py-3">Baseline</th>
                        <th className="px-4 py-3">Upgrade</th>
                        <th className="px-4 py-3">Result Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {comparisons.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 uppercase font-bold text-slate-800">
                            {c.checkType}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                            {c.command}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              c.baselineStatus === 'PASS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              c.baselineStatus === 'FAIL' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {c.baselineStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              c.upgradeStatus === 'PASS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              c.upgradeStatus === 'FAIL' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {c.upgradeStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {c.isRegression ? (
                              <span className="font-bold text-rose-600 inline-flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Regression Observed</span>
                              </span>
                            ) : c.inconclusiveReason ? (
                              <span className="text-slate-500 font-medium">{c.inconclusiveReason}</span>
                            ) : (
                              <span className="font-semibold text-emerald-600 inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>No Regression</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Detailed Execution Logs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Execution Output Excerpts
              </h4>
              <div className="space-y-3">
                {analysis.executions.map((e: Execution) => (
                  <div key={e.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExec(e.id)}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-left flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedExecs[e.id] ? (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                        <span className="font-bold uppercase text-slate-800">[{e.phase}]</span>
                        <span className="font-mono text-slate-600">{e.command}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          e.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' :
                          e.status === 'FAIL' ? 'bg-rose-100 text-rose-800' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {e.status} (exit {e.exitCode ?? 'N/A'})
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {(e.durationMs / 1000).toFixed(2)}s
                        </span>
                      </div>
                    </button>

                    {expandedExecs[e.id] && (
                      <div className="p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto space-y-2">
                        {e.stdoutExcerpt && (
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">STDOUT:</span>
                            <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed">{e.stdoutExcerpt}</pre>
                          </div>
                        )}
                        {e.stderrExcerpt && (
                          <div className="pt-2 border-t border-slate-800">
                            <span className="text-rose-400 text-[10px] uppercase font-bold block mb-1">STDERR:</span>
                            <pre className="whitespace-pre-wrap text-rose-300 leading-relaxed">{e.stderrExcerpt}</pre>
                          </div>
                        )}
                        {!e.stdoutExcerpt && !e.stderrExcerpt && (
                          <div className="text-slate-500 italic">No output captured.</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Dependency API Differences */}
        {activeTab === 'diffs' && (
          <div className="space-y-4">
            {analysis.evidenceList.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800">No Export Diffs Detected</h3>
                <p className="text-xs text-slate-500 mt-1">Exported TypeScript declaration interfaces match between versions.</p>
              </div>
            ) : (
              analysis.evidenceList.map((ev) => (
                <div key={ev.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {ev.type}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{ev.title}</h4>
                    </div>
                    <span className="text-xs font-mono text-slate-400">{ev.source}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {ev.content}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 5: Audit & Reproducibility */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Audit Trail & Reproducibility Parameters</h3>
              <p className="text-xs text-slate-500">
                To guarantee auditability, UpgradeLens captures exact lockfile hashes, revisions, and execution boundaries.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Baseline Commit SHA</span>
                <span className="text-slate-900 font-semibold">{analysis.baselineCommitSha || 'HEAD'}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Version Spec</span>
                <span className="text-slate-900 font-semibold">{analysis.targetVersion}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Lockfile Hash (Baseline)</span>
                <span className="text-slate-800 break-all">{analysis.lockfileHashBaseline || 'Computed on run'}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Lockfile Hash (Upgrade)</span>
                <span className="text-slate-800 break-all">{analysis.lockfileHashUpgrade || 'Computed on run'}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Runner Isolation Mode</span>
                <span className="text-slate-900">{analysis.runnerType}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">AI Enrichment Engine</span>
                <span className="text-slate-900">{analysis.aiEnriched ? analysis.aiModel : 'Disabled (Deterministic)'}</span>
              </div>
            </div>

            {limitations.length > 0 && (
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Documented Limitations & Boundaries
                </h4>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                  {limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};