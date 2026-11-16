import { Router } from 'express';
import { z } from 'zod';
import { getPrismaClient } from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const projectRouter = Router();

// Apply auth to all project routes
projectRouter.use(requireAuth);

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  repoUrl: z.string().url('Must be a valid repository URL'),
  defaultBranch: z.string().default('main')
});

// GET /api/projects
projectRouter.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const prisma = await getPrismaClient();

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { analyses: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return res.json({
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        repoUrl: p.repoUrl,
        defaultBranch: p.defaultBranch,
        analysisCount: p._count.analyses,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString()
      }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects
projectRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid project data',
        details: parsed.error.format()
      });
    }

    const { name, repoUrl, defaultBranch } = parsed.data;
    const user = req.user!;
    const prisma = await getPrismaClient();

    const project = await prisma.project.create({
      data: {
        name,
        repoUrl,
        defaultBranch,
        userId: user.id
      }
    });

    return res.status(201).json({
      project: {
        id: project.id,
        name: project.name,
        repoUrl: project.repoUrl,
        defaultBranch: project.defaultBranch,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id
projectRouter.get('/:id', async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const user = req.user!;
    const prisma = await getPrismaClient();

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!project) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    // Ownership check
    if (project.userId !== user.id) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    return res.json({
      project: {
        id: project.id,
        name: project.name,
        repoUrl: project.repoUrl,
        defaultBranch: project.defaultBranch,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        analyses: project.analyses.map(a => ({
          id: a.id,
          dependencyName: a.dependencyName,
          baselineVersion: a.baselineVersion,
          targetVersion: a.targetVersion,
          stage: a.stage,
          overallOutcome: a.overallOutcome,
          createdAt: a.createdAt.toISOString()
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});
