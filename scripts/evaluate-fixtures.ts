import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '../apps/api/src/db.js';
import { getQueueService } from '../apps/api/src/queue/index.js';
import { runAnalysisPipeline } from '../apps/worker/src/orchestrator.js';

interface ScenarioResult {
  scenarioId: string;
  name: string;
  expectedOutcome: string;
  observedOutcome: string;
  stage: string;
  durationMs: number;
  passed: boolean;
  reason: string;
}

async function main() {
  console.log('====================================================');
  console.log('   UpgradeLens Fixture Evaluation Suite (8 Scenarios)');
  console.log('====================================================\n');

  const prisma = await getPrismaClient();
  const queueService = getQueueService();

  // Create Evaluation Test User
  const evalUser = await prisma.user.upsert({
    where: { email: 'eval-suite@upgradelens.internal' },
    update: {},
    create: {
      email: 'eval-suite@upgradelens.internal',
      name: 'Evaluation Suite Runner',
      passwordHash: 'not-used-in-eval'
    }
  });

  const evalProject = await prisma.project.upsert({
    where: { id: 'eval-project-default' },
    update: {},
    create: {
      id: 'eval-project-default',
      name: 'Fixture Evaluation Project',
      repoUrl: 'https://github.com/upgradelens/fixtures',
      userId: evalUser.id
    }
  });

  const results: ScenarioResult[] = [];
  const scenarios = [
    { id: 'scenario-1', expected: 'REGRESSION_OBSERVED' },
    { id: 'scenario-2', expected: 'REGRESSION_OBSERVED' },
    { id: 'scenario-3', expected: 'NO_REGRESSION_OBSERVED' },
    { id: 'scenario-4', expected: 'INCONCLUSIVE' },
    { id: 'scenario-5', expected: 'NO_REGRESSION_OBSERVED' },
    { id: 'scenario-6', expected: 'INCONCLUSIVE' },
    { id: 'scenario-7', expected: 'CANCELLED' },
    { id: 'scenario-8', expected: 'NO_REGRESSION_OBSERVED' }
  ];

  for (const s of scenarios) {
    const num = s.id.replace('scenario-', '');
    const metaPath = path.resolve(process.cwd(), `fixtures/scenarios/${num}/metadata.json`);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    console.log(`▶ Running Scenario ${num}: ${meta.name}...`);
    const t0 = Date.now();

    const analysis = await prisma.analysis.create({
      data: {
        projectId: evalProject.id,
        userId: evalUser.id,
        repoUrl: `https://github.com/upgradelens/fixture-${s.id}`,
        dependencyName: meta.dependencyName,
        baselineVersion: meta.baselineVersion,
        targetVersion: meta.targetVersion,
        baselineCommitSha: `fixture-${s.id}-base`,
        stage: 'queued',
        runnerType: 'process'
      }
    });

    const abortController = new AbortController();

    // For Scenario 7 (Cancellation), trigger abort after 300ms
    if (s.id === 'scenario-7') {
      setTimeout(() => {
        console.log('   [Cancel Triggered for Scenario 7]');
        abortController.abort();
      }, 300);
    }

    try {
      await runAnalysisPipeline(
        prisma,
        queueService,
        {
          analysisId: analysis.id,
          userId: evalUser.id,
          mode: 'fixture',
          scenarioId: s.id,
          attemptNumber: 1
        },
        abortController.signal
      );
    } catch {}

    const completed = await prisma.analysis.findUnique({
      where: { id: analysis.id }
    });

    const durationMs = Date.now() - t0;
    const observedOutcome = s.id === 'scenario-7'
      ? (completed?.stage === 'cancelled' ? 'CANCELLED' : completed?.stage || 'UNKNOWN')
      : (completed?.overallOutcome || completed?.stage || 'UNKNOWN');

    const passed = observedOutcome === s.expected;

    results.push({
      scenarioId: s.id,
      name: meta.name,
      expectedOutcome: s.expected,
      observedOutcome,
      stage: completed?.stage || 'unknown',
      durationMs,
      passed,
      reason: completed?.outcomeReason || completed?.errorDetails || 'N/A'
    });

    console.log(`   Result: ${passed ? '✔ PASS' : '❌ FAIL'} | Expected: ${s.expected} | Observed: ${observedOutcome} (${durationMs}ms)\n`);
  }

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  console.log('====================================================');
  console.log(`   EVALUATION RESULTS: ${passedCount}/${results.length} PASSED`);
  console.log('====================================================\n');

  console.table(results.map(r => ({
    Scenario: r.scenarioId,
    Name: r.name.slice(0, 32),
    Expected: r.expectedOutcome,
    Observed: r.observedOutcome,
    Status: r.passed ? 'PASS' : 'FAIL',
    Duration: `${r.durationMs}ms`
  })));

  // Write machine-readable and human-readable reports
  const outDir = path.resolve(process.cwd(), '.data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'fixture-eval-report.json'), JSON.stringify(results, null, 2));

  if (passedCount !== results.length) {
    console.error(`❌ ${results.length - passedCount} scenario(s) failed evaluation.`);
    process.exit(1);
  }

  console.log('\n✔ All 8 fixture scenarios passed evaluation perfectly!');
}

main().catch(err => {
  console.error('Fatal evaluation runner error:', err);
  process.exit(1);
});
