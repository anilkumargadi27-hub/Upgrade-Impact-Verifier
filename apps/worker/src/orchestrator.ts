import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import {
  diffDeclarations,
  scanDirectoryForDependencyUsages,
  correlateChangesWithUsages
} from '@upgradelens/analyzer';
import {
  executeWorkspaceChecks,
  compareExecutions
} from '@upgradelens/runner';
import type {
  AnalysisStage,
  AnalysisReport,
  AnalysisOutcome,
  Finding,
  Evidence,
  Execution,
  PairedCheckComparison,
  AnalysisJobData,
  IQueueService
} from '@upgradelens/contracts';
import { inspectAndValidatePr } from './github.js';
import { enrichFindingsWithGemini } from './gemini.js';

/**
 * Copy directory recursively
 */
function copyDirSync(src: string, dest: string, exclude: string[] = []) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Hash file contents
 */
function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return 'missing';
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Execute the full 14-stage analysis pipeline
 */
export async function runAnalysisPipeline(
  prisma: PrismaClient,
  queueService: IQueueService,
  jobData: AnalysisJobData,
  abortSignal: AbortSignal
): Promise<void> {
  const { analysisId, mode, scenarioId } = jobData;
  const startTime = Date.now();

  const emitStage = async (stage: AnalysisStage, message: string, data?: Record<string, any>) => {
    console.log(`[Pipeline:${analysisId}] Stage: ${stage} - ${message}`);
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { stage }
    });

    await queueService.publishEvent({
      id: `evt_${analysisId}_${Date.now()}`,
      analysisId,
      stage,
      message,
      timestamp: new Date().toISOString(),
      data
    });
  };

  const checkCancellation = () => {
    if (abortSignal.aborted) {
      throw new Error('ANALYSIS_CANCELLED');
    }
  };

  const workDir = path.resolve(process.cwd(), `.data/workspaces/${analysisId}`);
  const baselineDir = path.join(workDir, 'baseline');
  const upgradeDir = path.join(workDir, 'upgrade');

  try {
    // Stage 1: queued
    await emitStage('queued', 'Analysis job queued and picked up by worker.');
    checkCancellation();

    // Stage 2: fetching
    await emitStage('fetching', 'Retrieving baseline revision and dependency metadata.');
    checkCancellation();

    let dependencyName = jobData.dependencyName || '';
    let baselineVer = jobData.baselineVersion || '1.0.0';
    let targetVer = jobData.targetVersion || '2.0.0';
    let baselineSha = jobData.baselineCommitSha || 'commit_base_fixture';
    let targetSha: string | null = null;
    let repoUrl = jobData.repoUrl || 'https://github.com/fixture/app';
    let prUrl = jobData.prUrl || null;
    let baselineDtsContent = '';
    let upgradeDtsContent = '';

    fs.mkdirSync(workDir, { recursive: true });

    if (mode === 'fixture') {
      const scenarioNumber = scenarioId ? scenarioId.replace(/^scenario-?/, '') : '1';
      const scenarioPath = path.resolve(process.cwd(), `fixtures/scenarios/${scenarioNumber}`);

      if (!fs.existsSync(scenarioPath)) {
        throw new Error(`Fixture scenario '${scenarioId}' not found at ${scenarioPath}`);
      }

      const metaPath = path.join(scenarioPath, 'metadata.json');
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

      dependencyName = meta.dependencyName;
      baselineVer = meta.baselineVersion;
      targetVer = meta.targetVersion;
      repoUrl = `https://github.com/upgradelens/fixtures-${meta.id}`;
      baselineSha = `fixture-${scenarioNumber}-base`;

      // Copy template to baseline and upgrade workspaces
      copyDirSync(scenarioPath, baselineDir, ['node_modules', 'metadata.json']);
      copyDirSync(scenarioPath, upgradeDir, ['node_modules', 'metadata.json']);

      // Setup mock package declarations
      const basePkgDir = path.resolve(process.cwd(), `fixtures/packages/${dependencyName}-${baselineVer}`);
      const upPkgDir = path.resolve(process.cwd(), `fixtures/packages/${dependencyName}-${targetVer}`);

      if (fs.existsSync(basePkgDir)) {
        copyDirSync(basePkgDir, path.join(baselineDir, 'node_modules', dependencyName));
        const dts = path.join(basePkgDir, 'index.d.ts');
        if (fs.existsSync(dts)) baselineDtsContent = fs.readFileSync(dts, 'utf-8');
      }

      if (fs.existsSync(upPkgDir)) {
        copyDirSync(upPkgDir, path.join(upgradeDir, 'node_modules', dependencyName));
        const dts = path.join(upPkgDir, 'index.d.ts');
        if (fs.existsSync(dts)) upgradeDtsContent = fs.readFileSync(dts, 'utf-8');
      }
    } else if (mode === 'pr' && prUrl) {
      const validation = await inspectAndValidatePr(prUrl, process.env.GITHUB_TOKEN);
      if (!validation.valid) {
        throw new Error(validation.unsupportedReason || validation.error || 'PR validation failed');
      }

      const pr = validation.prInfo!;
      dependencyName = pr.dependencyName;
      baselineVer = pr.baselineVersion;
      targetVer = pr.targetVersion;
      baselineSha = pr.baseSha;
      targetSha = pr.headSha;
      repoUrl = `https://github.com/${pr.repoOwner}/${pr.repoName}`;
    }

    // Stage 3: validating
    await emitStage('validating', 'Validating supported scope and package configuration.');
    checkCancellation();

    const baselinePkgJson = path.join(baselineDir, 'package.json');
    if (!fs.existsSync(baselinePkgJson)) {
      throw new Error('Unsupported repository: No package.json found at root directory.');
    }

    // Stage 4: extracting_changes
    await emitStage('extracting_changes', `Extracting API export maps and declarations for ${dependencyName}@${targetVer}.`);
    checkCancellation();

    const apiChanges = diffDeclarations(baselineDtsContent, upgradeDtsContent, dependencyName);

    // Stage 5: scanning_usage
    await emitStage('scanning_usage', `AST scanning application code for imports and calls of ${dependencyName}.`);
    checkCancellation();

    const usages = scanDirectoryForDependencyUsages(baselineDir, dependencyName);
    const { findings, evidence } = correlateChangesWithUsages(
      analysisId,
      dependencyName,
      baselineVer,
      targetVer,
      apiChanges,
      usages
    );

    // Stage 6: preparing_runs
    await emitStage('preparing_runs', 'Configuring isolated baseline and upgrade workspaces.');
    checkCancellation();

    // Update upgrade workspace package.json to requested targetVersion
    const upgradePkgJsonPath = path.join(upgradeDir, 'package.json');
    if (fs.existsSync(upgradePkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(upgradePkgJsonPath, 'utf-8'));
      if (pkg.dependencies && pkg.dependencies[dependencyName]) {
        pkg.dependencies[dependencyName] = targetVer;
      }
      fs.writeFileSync(upgradePkgJsonPath, JSON.stringify(pkg, null, 2));
    }

    const baselineLockHash = hashFile(path.join(baselineDir, 'package-lock.json'));
    const upgradeLockHash = hashFile(path.join(upgradeDir, 'package-lock.json'));

    // Stage 7: running_baseline
    await emitStage('running_baseline', 'Executing baseline checks (build, typecheck, test) on clean baseline workspace.');
    checkCancellation();

    const checkTimeoutMs = scenarioId === 'scenario-6' ? 2500 : 15000;
    const baselineResult = await executeWorkspaceChecks(baselineDir, 'BASELINE', checkTimeoutMs);
    checkCancellation();

    // Stage 8: running_upgrade
    await emitStage('running_upgrade', `Executing comparable checks on upgraded workspace with ${dependencyName}@${targetVer}.`);
    checkCancellation();

    const upgradeResult = await executeWorkspaceChecks(upgradeDir, 'UPGRADE', checkTimeoutMs);
    checkCancellation();

    // Stage 9: comparing
    await emitStage('comparing', 'Evaluating check outcomes pairwise and classifying impact.');
    checkCancellation();

    const hasStaticFindings = findings.length > 0;
    const comparisonResult = compareExecutions(analysisId, baselineResult, upgradeResult, hasStaticFindings);

    // Update finding verification statuses
    for (const finding of findings) {
      if (comparisonResult.overallOutcome === 'REGRESSION_OBSERVED') {
        finding.verificationStatus = 'VERIFIED_FAILING';
      } else if (comparisonResult.overallOutcome === 'NO_REGRESSION_OBSERVED') {
        finding.verificationStatus = 'VERIFIED_PASSING';
      }
    }

    // Stage 10: generating_report
    await emitStage('generating_report', 'Assembling immutable report snapshot and optional AI enrichment.');
    checkCancellation();

    let aiEnriched = false;
    let aiModel: string | null = null;

    if (process.env.AI_ENABLED === 'true' && findings.length > 0) {
      const aiRes = await enrichFindingsWithGemini(findings, dependencyName, baselineVer, targetVer);
      if (aiRes.enriched) {
        aiEnriched = true;
        aiModel = aiRes.modelUsed || 'gemini-1.5-flash';
        for (const exp of aiRes.explanations) {
          const f = findings.find(item => item.id === exp.findingId);
          if (f) {
            f.explanation = `${f.explanation}\n\n[AI Explanation]: ${exp.explanation}`;
            if (exp.suggestedMigration) {
              f.suggestedMigration = exp.suggestedMigration;
            }
          }
        }
      }
    }

    const fullReport: AnalysisReport = {
      analysisId,
      projectId: jobData.userId,
      projectName: dependencyName,
      repoUrl,
      prUrl,
      baselineCommitSha: baselineSha,
      targetCommitSha: targetSha,
      dependencyName,
      baselineVersion: baselineVer,
      targetVersion: targetVer,
      lockfileHashBaseline: baselineLockHash,
      lockfileHashUpgrade: upgradeLockHash,
      transitiveChanges: [],
      overallOutcome: comparisonResult.overallOutcome,
      outcomeReason: comparisonResult.outcomeReason,
      findings,
      evidenceList: evidence,
      executions: comparisonResult.executions,
      comparisons: comparisonResult.comparisons,
      aiEnriched,
      aiModel,
      limitations: comparisonResult.limitations,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      runnerType: process.env.RUNNER_TYPE || 'process'
    };

    // Save all findings, evidence, executions to database
    for (const f of findings) {
      await prisma.finding.create({
        data: {
          id: f.id,
          analysisId,
          title: f.title,
          symbol: f.symbol,
          changeCategory: f.changeCategory,
          severity: f.severity,
          evidenceStrength: f.evidenceStrength,
          dependencyName: f.dependencyName,
          baselineVersion: f.baselineVersion,
          targetVersion: f.targetVersion,
          affectedFile: f.affectedFile,
          startLine: f.startLine,
          endLine: f.endLine,
          codeSnippet: f.codeSnippet,
          explanation: f.explanation,
          suggestedMigration: f.suggestedMigration,
          verificationStatus: f.verificationStatus,
          limitationsJson: JSON.stringify(f.limitations),
          linkedEvidenceJson: JSON.stringify(f.linkedEvidenceIds)
        }
      });
    }

    for (const e of evidence) {
      await prisma.evidence.create({
        data: {
          id: e.id,
          analysisId,
          type: e.type,
          source: e.source,
          title: e.title,
          content: e.content,
          metadataJson: e.metadata ? JSON.stringify(e.metadata) : null
        }
      });
    }

    for (const ex of comparisonResult.executions) {
      await prisma.execution.create({
        data: {
          id: ex.id,
          analysisId,
          phase: ex.phase,
          checkType: ex.checkType,
          command: ex.command,
          status: ex.status,
          exitCode: ex.exitCode,
          durationMs: ex.durationMs,
          stdoutExcerpt: ex.stdoutExcerpt,
          stderrExcerpt: ex.stderrExcerpt,
          errorDetails: ex.errorDetails
        }
      });
    }

    // Persist final completed analysis snapshot
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        stage: 'completed',
        overallOutcome: fullReport.overallOutcome,
        outcomeReason: fullReport.outcomeReason,
        reportSnapshot: JSON.stringify(fullReport),
        completedAt: new Date(),
        durationMs: fullReport.durationMs,
        aiEnriched,
        aiModel,
        lockfileHashBaseline: baselineLockHash,
        lockfileHashUpgrade: upgradeLockHash
      }
    });

    await emitStage('completed', `Analysis completed successfully with outcome: ${fullReport.overallOutcome}`, {
      overallOutcome: fullReport.overallOutcome,
      findingsCount: findings.length
    });
  } catch (err: any) {
    if (err.message === 'ANALYSIS_CANCELLED' || abortSignal.aborted) {
      console.log(`[Pipeline:${analysisId}] Analysis cancelled by user.`);
      await prisma.analysis.update({
        where: { id: analysisId },
        data: {
          stage: 'cancelled',
          outcomeReason: 'Analysis was cancelled by the user.',
          completedAt: new Date()
        }
      });
      await emitStage('cancelled', 'Analysis was cancelled by the user.');
    } else {
      console.error(`[Pipeline:${analysisId}] Failed:`, err);
      await prisma.analysis.update({
        where: { id: analysisId },
        data: {
          stage: 'failed',
          errorDetails: err.message || 'Unknown pipeline failure',
          completedAt: new Date()
        }
      });
      await emitStage('failed', `Analysis failed: ${err.message}`);
    }
  } finally {
    // Clean up temporary workspaces
    try {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    } catch {}
  }
}
