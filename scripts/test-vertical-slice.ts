import { getPrismaClient } from '../apps/api/src/db.js';
import { getQueueService } from '../apps/api/src/queue/index.js';
import { hashPassword, createSession } from '../apps/api/src/auth.js';
import { runAnalysisPipeline } from '../apps/worker/src/orchestrator.js';

async function main() {
  console.log('=== [TEST] Starting Vertical Slice Test ===');
  const prisma = await getPrismaClient();
  const queueService = getQueueService();

  // 1. Create User
  const email = `test-slice-${Date.now()}@upgradelens.dev`;
  const passwordHash = await hashPassword('SecurePassword123!');
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Vertical Slice Tester',
      passwordHash
    }
  });
  console.log('✔ [User Created]:', user.id, user.email);

  // 2. Create Session
  const { rawToken, session } = await createSession(prisma, user.id);
  console.log('✔ [Session Created]:', session.id, 'Token length:', rawToken.length);

  // 3. Create Project
  const project = await prisma.project.create({
    data: {
      name: 'Vertical Slice Fixture Project',
      repoUrl: 'https://github.com/upgradelens/fixtures-scenario-1',
      userId: user.id
    }
  });
  console.log('✔ [Project Created]:', project.id);

  // 4. Create Analysis for Scenario 1 (Removed export used by application)
  const analysis = await prisma.analysis.create({
    data: {
      projectId: project.id,
      userId: user.id,
      repoUrl: 'https://github.com/upgradelens/fixture-scenario-1',
      dependencyName: 'mock-date-utils',
      baselineVersion: '1.0.0',
      targetVersion: '2.0.0',
      baselineCommitSha: 'fixture-1-baseline',
      stage: 'queued',
      runnerType: 'process'
    }
  });
  console.log('✔ [Analysis Created]:', analysis.id);

  // 5. Run the actual pipeline directly via orchestrator
  console.log('▶ [Pipeline Execution Starting]...');
  const abortController = new AbortController();
  await runAnalysisPipeline(
    prisma,
    queueService,
    {
      analysisId: analysis.id,
      userId: user.id,
      mode: 'fixture',
      scenarioId: 'scenario-1',
      attemptNumber: 1
    },
    abortController.signal
  );

  // 6. Verify persisted results in database
  const completedAnalysis = await prisma.analysis.findUnique({
    where: { id: analysis.id },
    include: {
      findings: true,
      evidenceList: true,
      executions: true,
      events: true
    }
  });

  if (!completedAnalysis) {
    throw new Error('Analysis record not found after execution!');
  }

  console.log('✔ [Analysis Stage]:', completedAnalysis.stage);
  console.log('✔ [Overall Outcome]:', completedAnalysis.overallOutcome);
  console.log('✔ [Outcome Reason]:', completedAnalysis.outcomeReason);
  console.log('✔ [Findings Count]:', completedAnalysis.findings.length);
  console.log('✔ [Executions Count]:', completedAnalysis.executions.length);
  console.log('✔ [Events Count]:', completedAnalysis.events.length);

  // Assertions
  if (completedAnalysis.stage !== 'completed') {
    throw new Error(`Expected stage 'completed', got '${completedAnalysis.stage}'`);
  }

  if (completedAnalysis.overallOutcome !== 'REGRESSION_OBSERVED') {
    throw new Error(`Expected outcome 'REGRESSION_OBSERVED', got '${completedAnalysis.overallOutcome}'`);
  }

  if (completedAnalysis.findings.length === 0) {
    throw new Error('Expected at least 1 finding for removed export');
  }

  const finding = completedAnalysis.findings[0];
  console.log('✔ [First Finding Title]:', finding.title);
  console.log('✔ [First Finding Symbol]:', finding.symbol);
  console.log('✔ [First Finding File]:', finding.affectedFile);
  console.log('✔ [First Finding Verification Status]:', finding.verificationStatus);

  if (finding.verificationStatus !== 'VERIFIED_FAILING') {
    throw new Error(`Expected verificationStatus 'VERIFIED_FAILING', got '${finding.verificationStatus}'`);
  }

  if (!completedAnalysis.reportSnapshot) {
    throw new Error('Expected reportSnapshot JSON to be populated and immutable');
  }

  const snapshot = JSON.parse(completedAnalysis.reportSnapshot);
  console.log('✔ [Snapshot Validated]: report has', snapshot.findings.length, 'findings and outcome', snapshot.overallOutcome);

  console.log('\n🎉 ALL VERTICAL SLICE ASSERTIONS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('❌ Vertical slice test failed:', err);
  process.exit(1);
});
