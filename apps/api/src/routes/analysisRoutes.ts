import { Router } from 'express';
import {
  CreateAnalysisPRRequestSchema,
  CreateAnalysisManualRequestSchema,
  CreateAnalysisFixtureRequestSchema
} from '@upgradelens/contracts';
import { getPrismaClient } from '../db.js';
import { getQueueService } from '../queue/index.js';
import { requireAuth, requireAnalysisOwnership } from '../middleware/authMiddleware.js';

export const analysisRouter = Router();

// Apply auth to all analysis routes
analysisRouter.use(requireAuth);

// POST /api/analyses/fixture (Launches real analysis on built-in fixture)
analysisRouter.post('/fixture', async (req, res, next) => {
  try {
    const parsed = CreateAnalysisFixtureRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid fixture scenario ID',
        details: parsed.error.format()
      });
    }

    const { scenarioId } = parsed.data;
    const user = req.user!;
    const prisma = await getPrismaClient();
    const queueService = getQueueService();

    // Create or find a default Demo Project for user
    let project = await prisma.project.findFirst({
      where: { userId: user.id, name: 'Demonstration Fixtures' }
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: 'Demonstration Fixtures',
          repoUrl: 'https://github.com/upgradelens/fixtures',
          userId: user.id
        }
      });
    }

    // Create the Analysis record
    const analysis = await prisma.analysis.create({
      data: {
        projectId: project.id,
        userId: user.id,
        repoUrl: `https://github.com/upgradelens/fixture-${scenarioId}`,
        dependencyName: scenarioId.includes('math') ? 'mock-math-lib' : (scenarioId.includes('logger') ? 'mock-logger' : 'mock-date-utils'),
        baselineVersion: '1.0.0',
        targetVersion: scenarioId.includes('logger') ? '1.1.0' : '2.0.0',
        baselineCommitSha: `fixture-${scenarioId}-baseline`,
        stage: 'queued',
        runnerType: process.env.RUNNER_TYPE || 'process'
      }
    });

    // Record Attempt #1
    await prisma.analysisAttempt.create({
      data: {
        analysisId: analysis.id,
        attemptNumber: 1,
        status: 'queued'
      }
    });

    // Enqueue job into QueueService (BullMQ or in-process adapter)
    await queueService.enqueueJob({
      analysisId: analysis.id,
      userId: user.id,
      mode: 'fixture',
      scenarioId,
      attemptNumber: 1
    });

    return res.status(201).json({
      analysis: {
        id: analysis.id,
        projectId: analysis.projectId,
        dependencyName: analysis.dependencyName,
        baselineVersion: analysis.baselineVersion,
        targetVersion: analysis.targetVersion,
        stage: analysis.stage,
        createdAt: analysis.createdAt.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/analyses/pr (GitHub PR mode)
analysisRouter.post('/pr', async (req, res, next) => {
  try {
    const parsed = CreateAnalysisPRRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'A valid GitHub Pull Request URL is required.',
        details: parsed.error.format()
      });
    }

    const { prUrl } = parsed.data;
    const user = req.user!;
    const prisma = await getPrismaClient();
    const queueService = getQueueService();

    // Create or find Project for this repo
    const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    const repoName = match ? `${match[1]}/${match[2]}` : 'Unknown Repository';
    const repoUrl = match ? `https://github.com/${repoName}` : prUrl;

    let project = await prisma.project.findFirst({
      where: { userId: user.id, repoUrl }
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: repoName,
          repoUrl,
          userId: user.id
        }
      });
    }

    const analysis = await prisma.analysis.create({
      data: {
        projectId: project.id,
        userId: user.id,
        prUrl,
        repoUrl,
        dependencyName: 'Resolving...',
        baselineVersion: 'Resolving...',
        targetVersion: 'Resolving...',
        baselineCommitSha: 'Resolving...',
        stage: 'queued',
        runnerType: process.env.RUNNER_TYPE || 'process'
      }
    });

    await prisma.analysisAttempt.create({
      data: {
        analysisId: analysis.id,
        attemptNumber: 1,
        status: 'queued'
      }
    });

    await queueService.enqueueJob({
      analysisId: analysis.id,
      userId: user.id,
      mode: 'pr',
      prUrl,
      attemptNumber: 1
    });

    return res.status(201).json({
      analysis: {
        id: analysis.id,
        projectId: analysis.projectId,
        prUrl: analysis.prUrl,
        stage: analysis.stage,
        createdAt: analysis.createdAt.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/analyses/manual (Repository + Dependency + Version mode)
analysisRouter.post('/manual', async (req, res, next) => {
  try {
    const parsed = CreateAnalysisManualRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid manual analysis parameters',
        details: parsed.error.format()
      });
    }

    const { repoUrl, dependencyName, targetVersion, baselineCommitSha } = parsed.data;
    const user = req.user!;
    const prisma = await getPrismaClient();
    const queueService = getQueueService();

    let project = await prisma.project.findFirst({
      where: { userId: user.id, repoUrl }
    });

    if (!project) {
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      const name = match ? `${match[1]}/${match[2]}` : repoUrl;
      project = await prisma.project.create({
        data: {
          name,
          repoUrl,
          userId: user.id
        }
      });
    }

    const analysis = await prisma.analysis.create({
      data: {
        projectId: project.id,
        userId: user.id,
        repoUrl,
        dependencyName,
        baselineVersion: 'Resolving...',
        targetVersion,
        baselineCommitSha: baselineCommitSha || 'HEAD',
        stage: 'queued',
        runnerType: process.env.RUNNER_TYPE || 'process'
      }
    });

    await prisma.analysisAttempt.create({
      data: {
        analysisId: analysis.id,
        attemptNumber: 1,
        status: 'queued'
      }
    });

    await queueService.enqueueJob({
      analysisId: analysis.id,
      userId: user.id,
      mode: 'manual',
      repoUrl,
      dependencyName,
      targetVersion,
      baselineCommitSha,
      attemptNumber: 1
    });

    return res.status(201).json({
      analysis: {
        id: analysis.id,
        projectId: analysis.projectId,
        dependencyName: analysis.dependencyName,
        targetVersion: analysis.targetVersion,
        stage: analysis.stage,
        createdAt: analysis.createdAt.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analyses (List user's analyses with filters and search)
analysisRouter.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const prisma = await getPrismaClient();

    const outcomeFilter = req.query.outcome as string | undefined;
    const stageFilter = req.query.stage as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '15', 10)));
    const skip = (page - 1) * limit;

    const where: any = { userId: user.id };

    if (outcomeFilter && outcomeFilter !== 'ALL') {
      where.overallOutcome = outcomeFilter;
    }

    if (stageFilter && stageFilter !== 'ALL') {
      where.stage = stageFilter;
    }

    if (search && search.trim()) {
      where.OR = [
        { dependencyName: { contains: search, mode: 'insensitive' } },
        { repoUrl: { contains: search, mode: 'insensitive' } },
        { project: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [total, analyses] = await Promise.all([
      prisma.analysis.count({ where }),
      prisma.analysis.findMany({
        where,
        include: {
          project: { select: { name: true } },
          _count: { select: { findings: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    return res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      analyses: analyses.map(a => ({
        id: a.id,
        projectId: a.projectId,
        projectName: a.project.name,
        repoUrl: a.repoUrl,
        prUrl: a.prUrl,
        dependencyName: a.dependencyName,
        baselineVersion: a.baselineVersion,
        targetVersion: a.targetVersion,
        stage: a.stage,
        overallOutcome: a.overallOutcome,
        outcomeReason: a.outcomeReason,
        findingsCount: a._count.findings,
        durationMs: a.durationMs,
        createdAt: a.createdAt.toISOString(),
        completedAt: a.completedAt?.toISOString() || null
      }))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analyses/:id (Get single analysis details or report snapshot)
analysisRouter.get('/:id', requireAnalysisOwnership, async (req, res, next) => {
  try {
    const analysisId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const prisma = await getPrismaClient();

    const analysis = (await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        project: { select: { name: true } },
        findings: true,
        evidenceList: true,
        executions: true,
        events: {
          orderBy: { timestamp: 'asc' },
          take: 100
        }
      }
    })) as any;

    if (!analysis) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Analysis not found' });
    }

    // Parse report snapshot if completed
    let snapshot: any = null;
    if (analysis.reportSnapshot) {
      try {
        snapshot = JSON.parse(analysis.reportSnapshot);
      } catch {}
    }

    return res.json({
      analysis: {
        id: analysis.id,
        projectId: analysis.projectId,
        projectName: analysis.project?.name || 'Project',
        repoUrl: analysis.repoUrl,
        prUrl: analysis.prUrl,
        dependencyName: analysis.dependencyName,
        baselineVersion: analysis.baselineVersion,
        targetVersion: analysis.targetVersion,
        baselineCommitSha: analysis.baselineCommitSha,
        targetCommitSha: analysis.targetCommitSha,
        lockfileHashBaseline: analysis.lockfileHashBaseline,
        lockfileHashUpgrade: analysis.lockfileHashUpgrade,
        stage: analysis.stage,
        overallOutcome: analysis.overallOutcome,
        outcomeReason: analysis.outcomeReason,
        runnerType: analysis.runnerType,
        aiEnriched: analysis.aiEnriched,
        aiModel: analysis.aiModel,
        errorDetails: analysis.errorDetails,
        durationMs: analysis.durationMs,
        createdAt: analysis.createdAt.toISOString(),
        completedAt: analysis.completedAt?.toISOString() || null,
        findings: (analysis.findings || []).map((f: any) => ({
          ...f,
          limitations: JSON.parse(f.limitationsJson || '[]'),
          linkedEvidenceIds: JSON.parse(f.linkedEvidenceJson || '[]')
        })),
        evidenceList: (analysis.evidenceList || []).map((e: any) => ({
          ...e,
          metadata: e.metadataJson ? JSON.parse(e.metadataJson) : null
        })),
        executions: analysis.executions || [],
        events: (analysis.events || []).map((ev: any) => ({
          id: ev.id,
          stage: ev.stage,
          message: ev.message,
          data: ev.dataJson ? JSON.parse(ev.dataJson) : null,
          timestamp: ev.timestamp.toISOString()
        })),
        reportSnapshot: snapshot
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/analyses/:id/cancel
analysisRouter.post('/:id/cancel', requireAnalysisOwnership, async (req, res, next) => {
  try {
    const analysisId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const queueService = getQueueService();
    const prisma = await getPrismaClient();

    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { stage: true }
    });

    if (!analysis) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Analysis not found' });
    }

    if (['completed', 'failed', 'cancelled'].includes(analysis.stage)) {
      return res.status(400).json({
        code: 'ALREADY_TERMINATED',
        message: `Cannot cancel analysis because it is already in stage '${analysis.stage}'.`
      });
    }

    await prisma.analysis.update({
      where: { id: analysisId },
      data: { stage: 'cancelling' }
    });

    await queueService.cancelJob(analysisId);

    return res.json({ success: true, message: 'Cancellation signal sent.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/analyses/:id/rerun
analysisRouter.post('/:id/rerun', requireAnalysisOwnership, async (req, res, next) => {
  try {
    const analysisId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const user = req.user!;
    const prisma = await getPrismaClient();
    const queueService = getQueueService();

    const original = await prisma.analysis.findUnique({
      where: { id: analysisId }
    });

    if (!original) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Analysis not found' });
    }

    const newAnalysis = await prisma.analysis.create({
      data: {
        projectId: original.projectId,
        userId: user.id,
        prUrl: original.prUrl,
        repoUrl: original.repoUrl,
        dependencyName: original.dependencyName,
        baselineVersion: original.baselineVersion,
        targetVersion: original.targetVersion,
        baselineCommitSha: original.baselineCommitSha,
        stage: 'queued',
        runnerType: original.runnerType,
        rerunOfId: original.id
      }
    });

    await prisma.analysisAttempt.create({
      data: {
        analysisId: newAnalysis.id,
        attemptNumber: 1,
        status: 'queued'
      }
    });

    const isFixture = original.repoUrl.includes('fixture');
    const scenarioMatch = original.repoUrl.match(/fixture-(scenario-\d+|\d+)/);
    const scenarioId = scenarioMatch ? scenarioMatch[1] : 'scenario-1';

    await queueService.enqueueJob({
      analysisId: newAnalysis.id,
      userId: user.id,
      mode: isFixture ? 'fixture' : (original.prUrl ? 'pr' : 'manual'),
      scenarioId,
      prUrl: original.prUrl || undefined,
      repoUrl: original.repoUrl,
      dependencyName: original.dependencyName,
      targetVersion: original.targetVersion,
      baselineCommitSha: original.baselineCommitSha,
      attemptNumber: 1
    });

    return res.status(201).json({
      analysis: {
        id: newAnalysis.id,
        rerunOfId: original.id,
        stage: newAnalysis.stage,
        createdAt: newAnalysis.createdAt.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analyses/:id/export/json (JSON Report Download)
analysisRouter.get('/:id/export/json', requireAnalysisOwnership, async (req, res, next) => {
  try {
    const analysisId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const prisma = await getPrismaClient();

    const analysis = (await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        findings: true,
        evidenceList: true,
        executions: true,
        project: { select: { name: true } }
      }
    })) as any;

    if (!analysis) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Analysis not found' });
    }

    let reportData = null;
    if (analysis.reportSnapshot) {
      try {
        reportData = JSON.parse(analysis.reportSnapshot);
      } catch {}
    }

    if (!reportData) {
      reportData = {
        analysisId: analysis.id,
        projectName: analysis.project?.name || 'Project',
        repoUrl: analysis.repoUrl,
        prUrl: analysis.prUrl,
        dependencyName: analysis.dependencyName,
        baselineVersion: analysis.baselineVersion,
        targetVersion: analysis.targetVersion,
        stage: analysis.stage,
        overallOutcome: analysis.overallOutcome,
        outcomeReason: analysis.outcomeReason,
        findings: analysis.findings || [],
        evidenceList: analysis.evidenceList || [],
        executions: analysis.executions || []
      };
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="upgradelens-${analysis.dependencyName}-${analysis.targetVersion}-report.json"`);
    return res.send(JSON.stringify(reportData, null, 2));
  } catch (err) {
    next(err);
  }
});

// GET /api/analyses/:id/export/markdown (Markdown Report Download)
analysisRouter.get('/:id/export/markdown', requireAnalysisOwnership, async (req, res, next) => {
  try {
    const analysisId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const prisma = await getPrismaClient();

    const analysis = (await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        findings: true,
        evidenceList: true,
        executions: true,
        project: { select: { name: true } }
      }
    })) as any;

    if (!analysis) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Analysis not found' });
    }

    let report: any = null;
    if (analysis.reportSnapshot) {
      try {
        report = JSON.parse(analysis.reportSnapshot);
      } catch {}
    }

    const findingsList: any[] = analysis.findings || [];
    const executionsList: any[] = analysis.executions || [];

    const md = `# UpgradeLens Analysis Report

**Dependency:** \`${analysis.dependencyName}\` (\`${analysis.baselineVersion}\` -> \`${analysis.targetVersion}\`)  
**Repository:** ${analysis.repoUrl}  
${analysis.prUrl ? `**Pull Request:** ${analysis.prUrl}  \n` : ''}**Overall Outcome:** **${analysis.overallOutcome || analysis.stage.toUpperCase()}**  
**Summary:** ${analysis.outcomeReason || 'Analysis in progress or pending.'}  
**Date:** ${new Date(analysis.completedAt || analysis.createdAt).toUTCString()}

---

## 1. Executive Summary
- **Baseline Commit:** \`${analysis.baselineCommitSha}\`
- **Target Version:** \`${analysis.targetVersion}\`
- **Lockfile Hash (Baseline):** \`${analysis.lockfileHashBaseline || 'N/A'}\`
- **Lockfile Hash (Upgrade):** \`${analysis.lockfileHashUpgrade || 'N/A'}\`
- **AI Enriched:** ${analysis.aiEnriched ? `Yes (${analysis.aiModel || 'Gemini'})` : 'No'}

---

## 2. Findings & Affected Application Code (${findingsList.length} findings)

${findingsList.length === 0 ? '_No breaking API usage or regressions detected._' : findingsList.map((f: any, i: number) => `
### ${i + 1}. ${f.title}
- **Symbol:** \`${f.symbol}\`
- **Severity:** \`${f.severity}\` | **Strength:** \`${f.evidenceStrength}\`
- **File:** \`${f.affectedFile}:${f.startLine}-${f.endLine}\`
- **Verification Status:** \`${f.verificationStatus}\`

\`\`\`javascript
${f.codeSnippet}
\`\`\`

**Explanation:**  
${f.explanation}

${f.suggestedMigration ? `**Suggested Migration:**  \n${f.suggestedMigration}\n` : ''}
`).join('\n---\n')}

---

## 3. Check Executions (Baseline vs. Upgrade)

| Check Type | Command | Phase | Status | Exit Code | Duration |
|------------|---------|-------|--------|-----------|----------|
${executionsList.map((e: any) => `| ${e.checkType} | \`${e.command}\` | ${e.phase} | ${e.status} | ${e.exitCode ?? 'N/A'} | ${e.durationMs}ms |`).join('\n')}

---

## 4. Limitations & Uncertainties
${(report?.limitations && report.limitations.length > 0)
  ? report.limitations.map((l: string) => `- ${l}`).join('\n')
  : '- Analysis is subject to the coverage of automated checks and static AST discovery.'}

_Generated by UpgradeLens - Upgrade Impact Verifier_
`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="upgradelens-${analysis.dependencyName}-${analysis.targetVersion}-report.md"`);
    return res.send(md);
  } catch (err) {
    next(err);
  }
});

// GET /api/analyses/:id/events (Server-Sent Events streaming with replay, heartbeat, reconnection)
analysisRouter.get('/:id/events', requireAnalysisOwnership, async (req, res) => {
  const analysisId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
  const prisma = await getPrismaClient();
  const queueService = getQueueService();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ analysisId, time: new Date().toISOString() })}\n\n`);

  try {
    const historicalEvents = await prisma.analysisEvent.findMany({
      where: { analysisId },
      orderBy: { timestamp: 'asc' }
    });

    for (const ev of historicalEvents) {
      res.write(`id: ${ev.id}\nevent: stage\ndata: ${JSON.stringify({
        id: ev.id,
        analysisId: ev.analysisId,
        stage: ev.stage,
        message: ev.message,
        data: ev.dataJson ? JSON.parse(ev.dataJson) : null,
        timestamp: ev.timestamp.toISOString()
      })}\n\n`);
    }
  } catch (err) {
    console.warn(`[SSE:${analysisId}] Error replaying events:`, err);
  }

  const unsubscribe = queueService.onEvent(analysisId, (event) => {
    res.write(`id: ${event.id}\nevent: stage\ndata: ${JSON.stringify(event)}\n\n`);
    if (['completed', 'failed', 'cancelled'].includes(event.stage)) {
      setTimeout(() => {
        try { res.end(); } catch {}
      }, 1000);
    }
  });

  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(pingInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    unsubscribe();
  });
});
