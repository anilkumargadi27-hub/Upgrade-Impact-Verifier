import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const fixtureRouter = Router();

export interface FixtureScenarioSummary {
  id: string;
  name: string;
  description: string;
  dependencyName: string;
  baselineVersion: string;
  targetVersion: string;
  expectedOutcome: string;
}

// GET /api/fixtures
fixtureRouter.get('/', async (_req, res, next) => {
  try {
    const scenarios: FixtureScenarioSummary[] = [];
    const baseDir = path.resolve(process.cwd(), 'fixtures/scenarios');

    if (fs.existsSync(baseDir)) {
      const dirs = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          const metaPath = path.join(baseDir, d.name, 'metadata.json');
          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
              scenarios.push(meta);
            } catch {}
          }
        }
      }
    }

    // Sort by id naturally
    scenarios.sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    return res.json({ scenarios });
  } catch (err) {
    next(err);
  }
});
