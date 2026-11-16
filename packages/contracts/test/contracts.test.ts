import { describe, it, expect } from 'vitest';
import {
  AnalysisOutcomeEnum,
  AnalysisStageEnum,
  FindingSeverityEnum,
  EvidenceStrengthEnum,
  CheckOutcomeEnum,
  CreateAnalysisManualRequestSchema,
  CreateAnalysisPRRequestSchema
} from '../src/index.js';

describe('Contracts & Schema Validation', () => {
  it('validates supported AnalysisOutcome values', () => {
    expect(AnalysisOutcomeEnum.parse('REGRESSION_OBSERVED')).toBe('REGRESSION_OBSERVED');
    expect(AnalysisOutcomeEnum.parse('POTENTIAL_IMPACT')).toBe('POTENTIAL_IMPACT');
    expect(AnalysisOutcomeEnum.parse('NO_REGRESSION_OBSERVED')).toBe('NO_REGRESSION_OBSERVED');
    expect(AnalysisOutcomeEnum.parse('INCONCLUSIVE')).toBe('INCONCLUSIVE');
    expect(() => AnalysisOutcomeEnum.parse('ARBITRARY_SCORE')).toThrow();
  });

  it('validates PR analysis request schema', () => {
    const valid = CreateAnalysisPRRequestSchema.parse({
      prUrl: 'https://github.com/facebook/react/pull/12345'
    });
    expect(valid.prUrl).toBe('https://github.com/facebook/react/pull/12345');

    expect(() => CreateAnalysisPRRequestSchema.parse({ prUrl: 'invalid-url' })).toThrow();
  });

  it('validates Manual analysis request schema', () => {
    const valid = CreateAnalysisManualRequestSchema.parse({
      repoUrl: 'https://github.com/expressjs/express',
      dependencyName: 'debug',
      targetVersion: '4.3.5'
    });
    expect(valid.dependencyName).toBe('debug');
    expect(valid.targetVersion).toBe('4.3.5');

    expect(() =>
      CreateAnalysisManualRequestSchema.parse({
        repoUrl: 'not-a-repo',
        dependencyName: '',
        targetVersion: '1.0.0'
      })
    ).toThrow();
  });

  it('validates FindingSeverity and EvidenceStrength', () => {
    expect(FindingSeverityEnum.parse('HIGH')).toBe('HIGH');
    expect(FindingSeverityEnum.parse('MEDIUM')).toBe('MEDIUM');
    expect(EvidenceStrengthEnum.parse('DEFINITIVE_REGRESSION')).toBe('DEFINITIVE_REGRESSION');
    expect(CheckOutcomeEnum.parse('PASS')).toBe('PASS');
    expect(CheckOutcomeEnum.parse('FAIL')).toBe('FAIL');
  });
});