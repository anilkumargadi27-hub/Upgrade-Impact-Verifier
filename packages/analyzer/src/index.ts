import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import type {
  Finding,
  Evidence,
  ChangeCategory,
  FindingSeverity,
  EvidenceStrength
} from '@upgradelens/contracts';

export interface AstUsage {
  symbol: string;
  importedAs: string;
  importKind: 'named' | 'default' | 'namespace' | 'require' | 'destructured_require';
  file: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  callLocations: Array<{
    line: number;
    expression: string;
  }>;
}

export interface ApiChange {
  symbol: string;
  changeCategory: ChangeCategory;
  severity: FindingSeverity;
  description: string;
  baselineSignature?: string;
  targetSignature?: string;
}

export interface DeclaredExport {
  name: string;
  kind: 'function' | 'variable' | 'class' | 'interface' | 'type' | 'unknown';
  parameters?: Array<{
    name: string;
    type: string;
    isOptional: boolean;
  }>;
  returnType?: string;
  rawText: string;
}

/**
 * Scan a single source file for usages of a specific dependency using TypeScript AST parser
 */
export function scanSourceFile(
  sourceText: string,
  filePath: string,
  dependencyName: string
): AstUsage[] {
  const usages: AstUsage[] = [];
  const lines = sourceText.split(/\r?\n/);

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  // Track symbols imported from this dependency in this file
  // localName -> { originalSymbol, importKind, line }
  const importedSymbols = new Map<
    string,
    { originalSymbol: string; importKind: 'named' | 'default' | 'namespace' | 'require' | 'destructured_require'; line: number }
  >();

  function getBoundedSnippet(startL: number, endL: number, contextLines = 2): string {
    const from = Math.max(0, startL - 1 - contextLines);
    const to = Math.min(lines.length, endL + contextLines);
    return lines.slice(from, to).join('\n');
  }

  function getLine(pos: number): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  // First pass: identify imports and require() calls
  function visitImports(node: ts.Node) {
    // ES Imports: import ... from 'dependency'
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const modName = moduleSpecifier.text;
        if (modName === dependencyName || modName.startsWith(`${dependencyName}/`)) {
          const importClause = node.importClause;
          const importLine = getLine(node.getStart());

          if (importClause) {
            // Default import: import Foo from 'dep'
            if (importClause.name) {
              const localName = importClause.name.text;
              importedSymbols.set(localName, {
                originalSymbol: 'default',
                importKind: 'default',
                line: importLine
              });
            }

            // Named or Namespace imports
            if (importClause.namedBindings) {
              // Namespace: import * as Foo from 'dep'
              if (ts.isNamespaceImport(importClause.namedBindings)) {
                const localName = importClause.namedBindings.name.text;
                importedSymbols.set(localName, {
                  originalSymbol: '*',
                  importKind: 'namespace',
                  line: importLine
                });
              }
              // Named: import { foo, bar as baz } from 'dep'
              else if (ts.isNamedImports(importClause.namedBindings)) {
                for (const element of importClause.namedBindings.elements) {
                  const origName = element.propertyName ? element.propertyName.text : element.name.text;
                  const localName = element.name.text;
                  importedSymbols.set(localName, {
                    originalSymbol: origName,
                    importKind: 'named',
                    line: getLine(element.getStart())
                  });
                }
              }
            }
          }
        }
      }
    }

    // CommonJS: const ... = require('dependency')
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isCallExpression(decl.initializer)) {
          const call = decl.initializer;
          if (ts.isIdentifier(call.expression) && call.expression.text === 'require') {
            const arg = call.arguments[0];
            if (arg && ts.isStringLiteral(arg)) {
              const modName = arg.text;
              if (modName === dependencyName || modName.startsWith(`${dependencyName}/`)) {
                const line = getLine(decl.getStart());
                // const foo = require('dep')
                if (ts.isIdentifier(decl.name)) {
                  importedSymbols.set(decl.name.text, {
                    originalSymbol: 'default',
                    importKind: 'require',
                    line
                  });
                }
                // const { foo, bar: baz } = require('dep')
                else if (ts.isObjectBindingPattern(decl.name)) {
                  for (const elem of decl.name.elements) {
                    if (ts.isIdentifier(elem.name)) {
                      const origName = elem.propertyName && ts.isIdentifier(elem.propertyName)
                        ? elem.propertyName.text
                        : elem.name.text;
                      importedSymbols.set(elem.name.text, {
                        originalSymbol: origName,
                        importKind: 'destructured_require',
                        line: getLine(elem.getStart())
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visitImports);
  }

  visitImports(sourceFile);

  if (importedSymbols.size === 0) {
    return [];
  }

  // Second pass: track call sites and member accesses of imported symbols
  const callsByLocal = new Map<string, Array<{ line: number; expression: string }>>();
  for (const localName of importedSymbols.keys()) {
    callsByLocal.set(localName, []);
  }

  function visitCalls(node: ts.Node) {
    // Direct call: foo()
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        if (callsByLocal.has(name)) {
          callsByLocal.get(name)!.push({
            line: getLine(node.getStart()),
            expression: node.getText(sourceFile).slice(0, 100)
          });
        }
      }
      // Member call on namespace: dep.foo()
      else if (ts.isPropertyAccessExpression(node.expression)) {
        const obj = node.expression.expression;
        if (ts.isIdentifier(obj)) {
          const objName = obj.text;
          const propName = node.expression.name.text;
          if (callsByLocal.has(objName)) {
            callsByLocal.get(objName)!.push({
              line: getLine(node.getStart()),
              expression: `${propName}(...) on ${objName}`
            });
          }
        }
      }
    }

    ts.forEachChild(node, visitCalls);
  }

  visitCalls(sourceFile);

  // Assemble AstUsage objects
  for (const [localName, info] of importedSymbols.entries()) {
    const callSites = callsByLocal.get(localName) || [];
    const startL = info.line;
    const endL = callSites.length > 0 ? Math.max(startL, ...callSites.map(c => c.line)) : startL;

    usages.push({
      symbol: info.originalSymbol,
      importedAs: localName,
      importKind: info.importKind,
      file: filePath.replace(/\\/g, '/'),
      startLine: startL,
      endLine: endL,
      codeSnippet: getBoundedSnippet(startL, endL, 2),
      callLocations: callSites
    });
  }

  return usages;
}

/**
 * Scan an entire directory for usages of a dependency
 */
export function scanDirectoryForDependencyUsages(
  dirPath: string,
  dependencyName: string,
  options: { excludeDirs?: string[] } = {}
): AstUsage[] {
  const allUsages: AstUsage[] = [];
  const exclude = new Set([
    'node_modules',
    'dist',
    'build',
    '.git',
    '.next',
    'coverage',
    ...(options.excludeDirs || [])
  ]);

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!exclude.has(entry.name)) {
          walk(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(dirPath, fullPath).replace(/\\/g, '/');
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const fileUsages = scanSourceFile(content, relativePath, dependencyName);
            allUsages.push(...fileUsages);
          } catch {
            // Unparseable file: ignore gracefully
          }
        }
      }
    }
  }

  walk(dirPath);
  return allUsages;
}

/**
 * Extract public exports and signatures from TypeScript declarations (.d.ts or .ts)
 */
export function extractExportsFromDts(dtsContent: string): Map<string, DeclaredExport> {
  const exports = new Map<string, DeclaredExport>();

  const sourceFile = ts.createSourceFile(
    'index.d.ts',
    dtsContent,
    ts.ScriptTarget.Latest,
    true
  );

  for (const statement of sourceFile.statements) {
    // Check export modifier
    const isExported = ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      const params = statement.parameters.map(p => ({
        name: p.name.getText(sourceFile),
        type: p.type ? p.type.getText(sourceFile) : 'any',
        isOptional: !!p.questionToken || !!p.initializer
      }));
      const returnType = statement.type ? statement.type.getText(sourceFile) : 'void';
      exports.set(name, {
        name,
        kind: 'function',
        parameters: params,
        returnType,
        rawText: statement.getText(sourceFile)
      });
    } else if (ts.isVariableStatement(statement)) {
      if (isExported) {
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const name = decl.name.text;
            exports.set(name, {
              name,
              kind: 'variable',
              rawText: decl.getText(sourceFile)
            });
          }
        }
      }
    } else if (ts.isInterfaceDeclaration(statement)) {
      if (isExported) {
        exports.set(statement.name.text, {
          name: statement.name.text,
          kind: 'interface',
          rawText: statement.getText(sourceFile)
        });
      }
    } else if (ts.isTypeAliasDeclaration(statement)) {
      if (isExported) {
        exports.set(statement.name.text, {
          name: statement.name.text,
          kind: 'type',
          rawText: statement.getText(sourceFile)
        });
      }
    } else if (ts.isExportDeclaration(statement)) {
      // export { a, b as c }
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const elem of statement.exportClause.elements) {
          const exportName = elem.name.text;
          exports.set(exportName, {
            name: exportName,
            kind: 'unknown',
            rawText: elem.getText(sourceFile)
          });
        }
      }
    }
  }

  return exports;
}

/**
 * Compare two declaration files to discover breaking API differences
 */
export function diffDeclarations(
  baselineDts: string,
  upgradeDts: string,
  dependencyName: string
): ApiChange[] {
  const changes: ApiChange[] = [];
  const baselineExports = extractExportsFromDts(baselineDts);
  const upgradeExports = extractExportsFromDts(upgradeDts);

  // 1. Check for removed exports
  for (const [name, baselineExp] of baselineExports.entries()) {
    if (!upgradeExports.has(name)) {
      changes.push({
        symbol: name,
        changeCategory: 'REMOVED_EXPORT',
        severity: 'HIGH',
        description: `Exported symbol '${name}' was removed in ${dependencyName} update.`,
        baselineSignature: baselineExp.rawText
      });
      continue;
    }

    // 2. Check for signature changes (function parameters)
    const upgradeExp = upgradeExports.get(name)!;
    if (baselineExp.kind === 'function' && upgradeExp.kind === 'function') {
      const baseParams = baselineExp.parameters || [];
      const upParams = upgradeExp.parameters || [];

      const baseRequired = baseParams.filter(p => !p.isOptional).length;
      const upRequired = upParams.filter(p => !p.isOptional).length;

      // If upgrade requires more arguments than baseline, calling code might break
      if (upRequired > baseRequired) {
        changes.push({
          symbol: name,
          changeCategory: 'SIGNATURE_CHANGED',
          severity: 'HIGH',
          description: `Function '${name}' added ${upRequired - baseRequired} required parameter(s). Calling with old argument count will fail type-checking or runtime.`,
          baselineSignature: baselineExp.rawText,
          targetSignature: upgradeExp.rawText
        });
      }
    }
  }

  return changes;
}

/**
 * Correlate API changes with application usages to generate verifiable findings
 */
export function correlateChangesWithUsages(
  analysisId: string,
  dependencyName: string,
  baselineVersion: string,
  targetVersion: string,
  changes: ApiChange[],
  usages: AstUsage[]
): { findings: Finding[]; evidence: Evidence[] } {
  const findings: Finding[] = [];
  const evidence: Evidence[] = [];

  let findingIndex = 1;
  let evidenceIndex = 1;

  for (const change of changes) {
    // Find all usages of this symbol
    // Match either the symbol itself or '*' if imported via namespace
    const matchingUsages = usages.filter(
      u => u.symbol === change.symbol || u.symbol === '*' || (u.symbol === 'default' && change.symbol === 'default')
    );

    // Record raw API diff evidence regardless
    const diffEvidenceId = `evi_${analysisId}_diff_${evidenceIndex++}`;
    evidence.push({
      id: diffEvidenceId,
      analysisId,
      type: 'API_DIFF',
      source: `${dependencyName} TypeScript Declarations`,
      title: `API Difference in '${change.symbol}'`,
      content: `${change.description}\n\nBaseline:\n${change.baselineSignature || 'N/A'}\n\nTarget:\n${change.targetSignature || 'N/A'}`,
      metadata: { symbol: change.symbol, category: change.changeCategory },
      createdAt: new Date().toISOString()
    });

    // CRITICAL: If the application DOES NOT use the changed symbol, do not create an application finding!
    // (Addresses Scenario 8: Removed export that the application never uses)
    if (matchingUsages.length === 0) {
      continue;
    }

    for (const usage of matchingUsages) {
      const usageEvidenceId = `evi_${analysisId}_usage_${evidenceIndex++}`;
      evidence.push({
        id: usageEvidenceId,
        analysisId,
        type: 'AST_USAGE',
        source: `${usage.file}:${usage.startLine}`,
        title: `AST Usage of '${usage.symbol}' in ${usage.file}`,
        content: `Imported as '${usage.importedAs}' via ${usage.importKind}.\n\nCode snippet:\n${usage.codeSnippet}`,
        metadata: { file: usage.file, line: usage.startLine, symbol: usage.symbol },
        createdAt: new Date().toISOString()
      });

      const findingId = `find_${analysisId}_${findingIndex++}`;
      findings.push({
        id: findingId,
        analysisId,
        title: `${change.changeCategory === 'REMOVED_EXPORT' ? 'Removed export' : 'Breaking change in'} '${change.symbol}' affects ${usage.file}`,
        symbol: change.symbol,
        changeCategory: change.changeCategory,
        severity: change.severity,
        evidenceStrength: 'STATIC_ANALYSIS_WARNING',
        dependencyName,
        baselineVersion,
        targetVersion,
        affectedFile: usage.file,
        startLine: usage.startLine,
        endLine: usage.endLine,
        codeSnippet: usage.codeSnippet,
        explanation: `The application imports '${change.symbol}' in ${usage.file}:${usage.startLine}. ${change.description}`,
        suggestedMigration: change.changeCategory === 'REMOVED_EXPORT'
          ? `Review upstream release notes for '${change.symbol}' replacement or update import statements.`
          : `Update calls to '${change.symbol}' to satisfy the new signature.`,
        verificationStatus: 'UNEXECUTED',
        limitations: [
          'Static AST analysis cannot detect dynamic imports or computed property access'
        ],
        linkedEvidenceIds: [diffEvidenceId, usageEvidenceId],
        createdAt: new Date().toISOString()
      });
    }
  }

  return { findings, evidence };
}
