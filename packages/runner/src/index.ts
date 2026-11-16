import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import type {
  CheckType,
  CheckOutcome,
  ExecutionPhase,
  AnalysisOutcome,
  PairedCheckComparison,
  Execution
} from '@upgradelens/contracts';

export interface CommandOptions {
  cwd: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  offline?: boolean;
}

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  cancelled: boolean;
}

export interface CheckExecutionResult {
  checkType: CheckType;
  command: string;
  status: CheckOutcome;
  exitCode: number | null;
  durationMs: number;
  stdoutExcerpt: string;
  stderrExcerpt: string;
  errorDetails?: string;
}

export interface WorkspaceRunResult {
  phase: ExecutionPhase;
  checks: CheckExecutionResult[];
  success: boolean;
  error?: string;
}

export interface ComparisonResult {
  overallOutcome: AnalysisOutcome;
  outcomeReason: string;
  comparisons: PairedCheckComparison[];
  executions: Execution[];
  limitations: string[];
}

/**
 * Execute a command in a child process with strict bounds
 */
export function runProcess(
  command: string,
  args: string[],
  options: CommandOptions
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let cancelled = false;

    // Sanitize environment variables: strip host tokens, AWS keys, etc.
    const cleanEnv: Record<string, string> = {
      PATH: process.env.PATH || '',
      SYSTEMROOT: process.env.SYSTEMROOT || '',
      TEMP: process.env.TEMP || '',
      TMP: process.env.TMP || '',
      NODE_ENV: 'test',
      CI: 'true',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false',
      FORCE_COLOR: '0',
      ...(options.env || {})
    };

    if (options.offline) {
      cleanEnv.npm_config_offline = 'true';
    }

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: cleanEnv,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timeoutLimit = options.timeoutMs || 45000;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (process.platform === 'win32' && child.pid) {
          spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t'], { stdio: 'ignore' });
        } else {
          child.kill('SIGKILL');
        }
      } catch {}
    }, timeoutLimit);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      // Bound output in memory
      if (stdout.length > 200000) {
        stdout = stdout.slice(-150000);
      }
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > 200000) {
        stderr = stderr.slice(-150000);
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        exitCode: timedOut ? null : code,
        stdout,
        stderr,
        durationMs,
        timedOut,
        cancelled
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        exitCode: -1,
        stdout,
        stderr: `${stderr}\n${err.message}`,
        durationMs,
        timedOut: false,
        cancelled: false
      });
    });
  });
}

/**
 * Discover checks from package.json and execute them on a workspace
 */
export async function executeWorkspaceChecks(
  workspaceDir: string,
  phase: ExecutionPhase,
  timeoutMs = 30000
): Promise<WorkspaceRunResult> {
  const checks: CheckExecutionResult[] = [];
  const pkgJsonPath = path.join(workspaceDir, 'package.json');

  if (!fs.existsSync(pkgJsonPath)) {
    return {
      phase,
      checks: [],
      success: false,
      error: 'package.json not found in workspace'
    };
  }

  let pkg: any;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  } catch (err: any) {
    return {
      phase,
      checks: [],
      success: false,
      error: `Failed to parse package.json: ${err.message}`
    };
  }

  const scripts = pkg.scripts || {};

  // 1. Build check
  if (scripts.build) {
    const res = await runProcess('npm', ['run', 'build'], {
      cwd: workspaceDir,
      timeoutMs,
      offline: true
    });
    checks.push({
      checkType: 'BUILD',
      command: 'npm run build',
      status: res.timedOut ? 'TIMEOUT' : (res.exitCode === 0 ? 'PASS' : 'FAIL'),
      exitCode: res.exitCode,
      durationMs: res.durationMs,
      stdoutExcerpt: res.stdout.slice(-2000),
      stderrExcerpt: res.stderr.slice(-2000),
      errorDetails: res.exitCode !== 0 ? (res.stderr || res.stdout).slice(-1000) : undefined
    });
  }

  // 2. Type-check
  const typecheckCmd = scripts.typecheck
    ? ['run', 'typecheck']
    : scripts['type-check']
    ? ['run', 'type-check']
    : fs.existsSync(path.join(workspaceDir, 'tsconfig.json'))
    ? ['exec', '--', 'tsc', '--noEmit']
    : null;

  if (typecheckCmd) {
    const res = await runProcess('npm', typecheckCmd, {
      cwd: workspaceDir,
      timeoutMs,
      offline: true
    });
    checks.push({
      checkType: 'TYPECHECK',
      command: `npm ${typecheckCmd.join(' ')}`,
      status: res.timedOut ? 'TIMEOUT' : (res.exitCode === 0 ? 'PASS' : 'FAIL'),
      exitCode: res.exitCode,
      durationMs: res.durationMs,
      stdoutExcerpt: res.stdout.slice(-2000),
      stderrExcerpt: res.stderr.slice(-2000),
      errorDetails: res.exitCode !== 0 ? (res.stderr || res.stdout).slice(-1000) : undefined
    });
  }

  // 3. Test check
  if (scripts.test && !scripts.test.includes('no test specified')) {
    const res = await runProcess('npm', ['test'], {
      cwd: workspaceDir,
      timeoutMs,
      offline: true
    });
    checks.push({
      checkType: 'TEST',
      command: 'npm test',
      status: res.timedOut ? 'TIMEOUT' : (res.exitCode === 0 ? 'PASS' : 'FAIL'),
      exitCode: res.exitCode,
      durationMs: res.durationMs,
      stdoutExcerpt: res.stdout.slice(-2000),
      stderrExcerpt: res.stderr.slice(-2000),
      errorDetails: res.exitCode !== 0 ? (res.stderr || res.stdout).slice(-1000) : undefined
    });
  }

  return {
    phase,
    checks,
    success: true
  };
}

/**
 * Compare baseline and upgrade execution results according to credible result definition
 */
export function compareExecutions(
  analysisId: string,
  baseline: WorkspaceRunResult,
  upgrade: WorkspaceRunResult,
  hasStaticImpactFindings: boolean
): ComparisonResult {
  const comparisons: PairedCheckComparison[] = [];
  const executions: Execution[] = [];
  const limitations: string[] = [];

  let execIndex = 1;

  // Convert check results into Execution records
  for (const c of baseline.checks) {
    executions.push({
      id: `exec_${analysisId}_base_${execIndex++}`,
      analysisId,
      phase: 'BASELINE',
      checkType: c.checkType,
      command: c.command,
      status: c.status,
      exitCode: c.exitCode,
      durationMs: c.durationMs,
      stdoutExcerpt: c.stdoutExcerpt,
      stderrExcerpt: c.stderrExcerpt,
      errorDetails: c.errorDetails,
      createdAt: new Date().toISOString()
    });
  }

  for (const c of upgrade.checks) {
    executions.push({
      id: `exec_${analysisId}_up_${execIndex++}`,
      analysisId,
      phase: 'UPGRADE',
      checkType: c.checkType,
      command: c.command,
      status: c.status,
      exitCode: c.exitCode,
      durationMs: c.durationMs,
      stdoutExcerpt: c.stdoutExcerpt,
      stderrExcerpt: c.stderrExcerpt,
      errorDetails: c.errorDetails,
      createdAt: new Date().toISOString()
    });
  }

  // Check 1: Missing checks
  const testChecks = baseline.checks.filter(c => c.checkType === 'TEST');
  if (testChecks.length === 0) {
    limitations.push('No test suite detected in repository package.json scripts (missing tests are not passing tests).');
  }

  // Check 2: Infrastructure / Timeout failures
  const anyTimeout = [...baseline.checks, ...upgrade.checks].some(c => c.status === 'TIMEOUT');
  if (anyTimeout) {
    return {
      overallOutcome: 'INCONCLUSIVE',
      outcomeReason: 'One or more execution checks exceeded the strict time limit and timed out.',
      comparisons,
      executions,
      limitations: [...limitations, 'Execution timed out before checks could complete.']
    };
  }

  // Pair checks by checkType
  const allCheckTypes = Array.from(new Set([
    ...baseline.checks.map(c => c.checkType),
    ...upgrade.checks.map(c => c.checkType)
  ]));

  let hasBaselineFailure = false;
  let hasRegression = false;
  let allPass = true;

  for (const type of allCheckTypes) {
    const baseCheck = baseline.checks.find(c => c.checkType === type);
    const upCheck = upgrade.checks.find(c => c.checkType === type);

    if (!baseCheck || !upCheck) {
      comparisons.push({
        checkType: type,
        command: baseCheck?.command || upCheck?.command || type,
        baselineStatus: baseCheck ? baseCheck.status : 'SKIPPED',
        upgradeStatus: upCheck ? upCheck.status : 'SKIPPED',
        isRegression: false,
        inconclusiveReason: 'Check was not available in both baseline and upgrade workspaces.'
      });
      continue;
    }

    const isReg = baseCheck.status === 'PASS' && upCheck.status === 'FAIL';
    if (baseCheck.status === 'FAIL') {
      hasBaselineFailure = true;
    }
    if (isReg) {
      hasRegression = true;
      allPass = false;
    } else if (upCheck.status !== 'PASS') {
      allPass = false;
    }

    comparisons.push({
      checkType: type,
      command: baseCheck.command,
      baselineStatus: baseCheck.status,
      upgradeStatus: upCheck.status,
      isRegression: isReg,
      inconclusiveReason: baseCheck.status === 'FAIL'
        ? 'Baseline check already failed prior to upgrade.'
        : undefined
    });
  }

  // Evaluate Overall Outcome strictly according to section 3:
  // - REGRESSION_OBSERVED: Comparable checks pass on baseline and fail after upgrade
  // - POTENTIAL_IMPACT: Source/API evidence indicates possible incompatibility, but execution does not establish a regression
  // - NO_REGRESSION_OBSERVED: Executed comparable checks show no regression (or no usage)
  // - INCONCLUSIVE: Baseline failures, missing checks, or errors prevent reliable conclusion

  if (hasBaselineFailure) {
    return {
      overallOutcome: 'INCONCLUSIVE',
      outcomeReason: 'Baseline checks failed before dependency upgrade was applied. Baseline instability prevents attributing failures to the dependency update.',
      comparisons,
      executions,
      limitations: [...limitations, 'Baseline application is broken on the target commit.']
    };
  }

  if (hasRegression) {
    return {
      overallOutcome: 'REGRESSION_OBSERVED',
      outcomeReason: 'One or more checks (build, type-check, or tests) passed on the baseline revision and failed after applying the dependency upgrade.',
      comparisons,
      executions,
      limitations
    };
  }

  // If checks all passed, but static AST analysis detected breaking API usage
  if (hasStaticImpactFindings && allCheckTypes.length > 0) {
    // If tests passed, but static AST found removed export that application calls, does that mean POTENTIAL_IMPACT?
    // Yes: "Source/API evidence indicates possible incompatibility, but execution does not establish a regression."
    return {
      overallOutcome: 'POTENTIAL_IMPACT',
      outcomeReason: 'API differences and application usage were detected by static analysis, but existing automated test checks did not observe a runtime failure.',
      comparisons,
      executions,
      limitations: [...limitations, 'Application test coverage may not exercise the affected code path.']
    };
  }

  if (allCheckTypes.length === 0) {
    if (hasStaticImpactFindings) {
      return {
        overallOutcome: 'POTENTIAL_IMPACT',
        outcomeReason: 'API differences detected in used symbols, but no executable checks exist in package.json.',
        comparisons,
        executions,
        limitations: [...limitations, 'No test, typecheck, or build scripts found in package.json.']
      };
    }
    return {
      overallOutcome: 'NO_REGRESSION_OBSERVED',
      outcomeReason: 'No regression observed in static analysis, though no automated test suite was available to execute.',
      comparisons,
      executions,
      limitations: [...limitations, 'Repository contains no automated checks.']
    };
  }

  return {
    overallOutcome: 'NO_REGRESSION_OBSERVED',
    outcomeReason: 'All comparable executed checks (build, typecheck, test) passed on both baseline and upgraded workspaces.',
    comparisons,
    executions,
    limitations
  };
}
