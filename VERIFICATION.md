# UpgradeLens Verification Matrix

This matrix tracks live verification for every requirement across all gates.

## Integration & Capability Matrix

| Integration / Subsystem | Verification Method | Status | Notes |
|-------------------------|---------------------|--------|-------|
| Local Monorepo Toolchain | npm build, typecheck (`tsc -b`, Vite) | **VERIFIED** | All packages and applications build with exit code 0. |
| PostgreSQL Database & Prisma | Schema migration, dual-mode PGlite/PG | **VERIFIED** | Prisma 6 client with PGlite adapter verified via vertical slice. |
| Authentication & Sessions | Argon2id, cookie, SHA-256 tokens | **VERIFIED** | Tested via `apps/api/test/auth.test.ts` (Argon2id + SHA-256 tokens). |
| Resource Ownership & Isolation | Middleware check & ownership filter | **VERIFIED** | `requireAnalysisOwnership` applied to all analysis endpoints. |
| Fixture Execution (8 scenarios) | Automated fixture test runner | **VERIFIED** | 8/8 passed in `scripts/evaluate-fixtures.ts`. |
| AST Usage Analysis | TypeScript compiler AST scanner | **VERIFIED** | Tested in `packages/analyzer/test/analyzer.test.ts`. |
| API Export Comparison | Declaration diffing (`diffDeclarations`) | **VERIFIED** | Tested in `packages/analyzer/test/analyzer.test.ts`. |
| Paired Execution & Classifier | Baseline vs Upgrade test runner | **VERIFIED** | Tested in `packages/runner/test/runner.test.ts`. |
| Live SSE Event Streaming | EventSource reconnection & fallback | **VERIFIED** | Endpoints `/api/analyses/:id/events` with heartbeat and replay. |
| Gemini AI Integration | Server adapter, deterministic fallback | **VERIFIED** | Structured output parser with schema validation & fallback. |
| Frontend Dashboard & Reports | React 18 + Vite + Tailwind SPA | **VERIFIED** | Built production bundle in `apps/web/dist` served by API. |
| Report Exports (JSON/Markdown) | Export endpoints (`/export/json`, `/markdown`)| **VERIFIED** | Download attachments verified in analysis routes. |
| Git Repository Push | `git push origin main` | **READY** | Remote configured to `anilkumargadi27-hub/Upgrade-Impact-Verifier.git`. |
| Render Web & Worker Services | Hosted deployment configuration | **READY** | `render.yaml` blueprint configured. |

## Fixture Verification Outcomes Table

| Scenario # | Scenario Name | Expected Outcome | Observed Outcome | Status |
|------------|---------------|------------------|------------------|--------|
| 1 | Removed export used by application | `REGRESSION_OBSERVED` | `REGRESSION_OBSERVED` | **VERIFIED** |
| 2 | Changed required argument detected by type checking | `REGRESSION_OBSERVED` | `REGRESSION_OBSERVED` | **VERIFIED** |
| 3 | Compatible update | `NO_REGRESSION_OBSERVED` | `NO_REGRESSION_OBSERVED` | **VERIFIED** |
| 4 | Baseline already failing | `INCONCLUSIVE` | `INCONCLUSIVE` | **VERIFIED** |
| 5 | Missing tests | `NO_REGRESSION_OBSERVED` | `NO_REGRESSION_OBSERVED` | **VERIFIED** |
| 6 | Timeout | `INCONCLUSIVE` | `INCONCLUSIVE` | **VERIFIED** |
| 7 | Cancellation | `CANCELLED` | `CANCELLED` | **VERIFIED** |
| 8 | Removed export that application never uses | `NO_REGRESSION_OBSERVED` | `NO_REGRESSION_OBSERVED` | **VERIFIED** |