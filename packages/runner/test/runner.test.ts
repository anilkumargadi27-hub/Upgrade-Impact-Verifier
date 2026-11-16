import { describe, it, expect } from 'vitest';
import { compareExecutions } from '../src/index.js';
import type { WorkspaceRunResult } from '../src/index.js';

describe('Runner Module - compareExecutions', () => {
  it('classifies REGRESSION_OBSERVED when baseline passed and upgrade failed', () => {
    const baseline: WorkspaceRunResult = {
      phase: 'BASELINE',
      success: true,
      checks: [
        {
          checkType: 'TEST',
          command: 'npm test',
          status: 'PASS',
          exitCode: 0,
          durationMs: 500,
          stdoutExcerpt: 'All tests pass',
          stderrExcerpt: ''
        }
      ]
    };

    const upgrade: WorkspaceRunResult = {
      phase: 'UPGRADE',
      success: false,
      checks: [
        {
          checkType: 'TEST',
          command: 'npm test',
          status: 'FAIL',
          exitCode: 1,
          durationMs: 600,
          stdoutExcerpt: '',
          stderrExcerpt: 'TypeError: calculateTotal is not a function'
        }
      ]
    };

    const result = compareExecutions('test-analysis', baseline, upgrade, 1);
    expect(result.overallOutcome).toBe('REGRESSION_OBSERVED');
    expect(result.comparisons[0].isRegression).toBe(true);
  });

  it('classifies INCONCLUSIVE when baseline was already failing', () => {
    const baseline: WorkspaceRunResult = {
      phase: 'BASELINE',
      success: false,
      checks: [
        {
          checkType: 'TEST',
          command: 'npm test',
          status: 'FAIL',
          exitCode: 1,
          durationMs: 500,
          stdoutExcerpt: '',
          stderrExcerpt: 'Baseline broken'
        }
      ]
    };

    const upgrade: WorkspaceRunResult = {
      phase: 'UPGRADE',
      success: false,
      checks: [
        {
          checkType: 'TEST',
          command: 'npm test',
          status: 'FAIL',
          exitCode: 1,
          durationMs: 500,
          stdoutExcerpt: '',
          stderrExcerpt: 'Still broken'
        }
      ]
    };

    const result = compareExecutions('test-analysis', baseline, upgrade, 0);
    expect(result.overallOutcome).toBe('INCONCLUSIVE');
  });

  it('classifies NO_REGRESSION_OBSERVED when all checks pass on both baseline and upgrade', () => {
    const baseline: WorkspaceRunResult = {
      phase: 'BASELINE',
      success: true,
      checks: [
        {
          checkType: 'TEST',
          command: 'npm test',
          status: 'PASS',
          exitCode: 0,
          durationMs: 400,
          stdoutExcerpt: 'Passed',
          stderrExcerpt: ''
        }
      ]
    };

    const upgrade: WorkspaceRunResult = {
      phase: 'UPGRADE',
      success: true,
      checks: [
        {
          checkType: 'TEST',
          command: 'npm test',
          status: 'PASS',
          exitCode: 0,
          durationMs: 400,
          stdoutExcerpt: 'Passed',
          stderrExcerpt: ''
        }
      ]
    };

    const result = compareExecutions('test-analysis', baseline, upgrade, 0);
    expect(result.overallOutcome).toBe('NO_REGRESSION_OBSERVED');
  });

  it('classifies POTENTIAL_IMPACT when checks pass or are missing, but API findings exist', () => {
    const baseline: WorkspaceRunResult = {
      phase: 'BASELINE',
      success: true,
      checks: [
        {
          checkType: 'TEST',
          command: 'npm test',
          status: 'PASS',
          exitCode: 0,
          durationMs: 400,
          stdoutExcerpt: 'Passed',
          stderrExcerpt: ''
        }
      ]
    };

    const upgrade: WorkspaceRunResult = {
      phase: 'UPGRADE',
      success: true,
      checks: [
        {
          checkType: 'TEST',
          command: 'npm test',
          status: 'PASS',
          exitCode: 0,
          durationMs: 400,
          stdoutExcerpt: 'Passed',
          stderrExcerpt: ''
        }
      ]
    };

    // 2 findings found in code, but test check passed (e.g. untested method called in app)
    const result = compareExecutions('test-analysis', baseline, upgrade, 2);
    expect(result.overallOutcome).toBe('POTENTIAL_IMPACT');
  });
});