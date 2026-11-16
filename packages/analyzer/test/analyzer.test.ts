import { describe, it, expect } from 'vitest';
import {
  scanSourceFile,
  diffDeclarations,
  correlateChangesWithUsages
} from '../src/index.js';

describe('Analyzer Module', () => {
  describe('scanSourceFile', () => {
    it('detects ES named import and call expressions', () => {
      const code = `
        import { format, parseISO } from 'date-fns';

        export function display(d: string) {
          return format(parseISO(d), 'yyyy-MM-dd');
        }
      `;
      const usages = scanSourceFile(code, 'src/utils.ts', 'date-fns');

      expect(usages.length).toBe(2);
      const symbols = usages.map(u => u.symbol);
      expect(symbols).toContain('format');
      expect(symbols).toContain('parseISO');
      expect(usages[0].file).toBe('src/utils.ts');
    });

    it('detects default import', () => {
      const code = `
        import lodash from 'lodash';
        const res = lodash.map([1, 2, 3], x => x * 2);
      `;
      const usages = scanSourceFile(code, 'src/math.js', 'lodash');

      expect(usages.length).toBe(1);
      expect(usages[0].symbol).toBe('default');
      expect(usages[0].importedAs).toBe('lodash');
    });

    it('detects CommonJS require', () => {
      const code = `
        const axios = require('axios');
        async function fetchUsers() {
          return axios.get('/users');
        }
      `;
      const usages = scanSourceFile(code, 'server.js', 'axios');

      expect(usages.length).toBe(1);
      expect(usages[0].importedAs).toBe('axios');
    });

    it('returns empty array when dependency is not used', () => {
      const code = `
        import { useState } from 'react';
        export const App = () => <div>Hello</div>;
      `;
      const usages = scanSourceFile(code, 'src/App.tsx', 'date-fns');
      expect(usages.length).toBe(0);
    });
  });

  describe('diffDeclarations', () => {
    it('detects removed export', () => {
      const baseDts = `
        export declare function calculateTotal(items: number[]): number;
        export declare function deprecatedHelper(): void;
      `;
      const upDts = `
        export declare function calculateTotal(items: number[]): number;
      `;

      const diffs = diffDeclarations(baseDts, upDts, 'calc-lib');
      expect(diffs.length).toBe(1);
      expect(diffs[0].symbol).toBe('deprecatedHelper');
      expect(diffs[0].changeCategory).toBe('REMOVED_EXPORT');
      expect(diffs[0].severity).toBe('HIGH');
    });

    it('detects breaking signature parameter additions', () => {
      const baseDts = `
        export declare function parseConfig(raw: string): object;
      `;
      const upDts = `
        export declare function parseConfig(raw: string, schema: object): object;
      `;

      const diffs = diffDeclarations(baseDts, upDts, 'config-parser');
      expect(diffs.length).toBe(1);
      expect(diffs[0].symbol).toBe('parseConfig');
      expect(diffs[0].changeCategory).toBe('SIGNATURE_CHANGED');
    });

    it('returns no diffs for backwards-compatible additions', () => {
      const baseDts = `
        export declare function query(q: string): string[];
      `;
      const upDts = `
        export declare function query(q: string, options?: object): string[];
        export declare function newHelper(): void;
      `;

      const diffs = diffDeclarations(baseDts, upDts, 'search-lib');
      expect(diffs.length).toBe(0);
    });
  });

  describe('correlateChangesWithUsages', () => {
    it('generates finding only when affected symbol is actually used by app', () => {
      const diffs = [
        {
          symbol: 'unusedRemovedFn',
          changeCategory: 'REMOVED_EXPORT' as const,
          severity: 'HIGH' as const,
          description: 'Removed unused function'
        },
        {
          symbol: 'usedFn',
          changeCategory: 'REMOVED_EXPORT' as const,
          severity: 'HIGH' as const,
          description: 'Removed used function'
        }
      ];

      const usages = [
        {
          symbol: 'usedFn',
          importedAs: 'usedFn',
          importKind: 'named' as const,
          file: 'src/main.ts',
          startLine: 5,
          endLine: 8,
          codeSnippet: 'usedFn();',
          callLocations: [{ line: 7, expression: 'usedFn()' }]
        }
      ];

      const result = correlateChangesWithUsages(
        'test-id',
        'my-dep',
        '1.0.0',
        '2.0.0',
        diffs,
        usages
      );

      // Diff evidence is recorded for both
      expect(result.evidence.length).toBeGreaterThanOrEqual(2);
      // Finding is ONLY recorded for usedFn (usage awareness!)
      expect(result.findings.length).toBe(1);
      expect(result.findings[0].symbol).toBe('usedFn');
      expect(result.findings[0].affectedFile).toBe('src/main.ts');
    });
  });
});