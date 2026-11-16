# UpgradeLens: Comprehensive Implementation Plan

**Project:** Upgrade Impact Verifier for Dependency Pull Requests  
**Product Name:** UpgradeLens  
**Project Owner:** G. Anil Kumar  
**Target Repository:** https://github.com/anilkumargadi27-hub/Upgrade-Impact-Verifier.git  
**Deployment Target:** Render (Web Service + Background Worker + PostgreSQL + Key Value)

---

## 1. Core Vision & Problem Statement

**Question:** *"If I upgrade this dependency, which parts of my application could break, and what evidence supports that conclusion?"*

### Credible Result Breakdown
1. **(A) What changed in the dependency:** Extracted AST differences, removed exports, signature modifications, changelogs.
2. **(B) Where the application uses the affected API:** AST usage scan finding exact file paths, line ranges, and identifiers.
3. **(C) What the checks actually observed:** Paired comparison (Baseline vs. Upgrade) of build, type-check, and test scripts.
4. **(D) What remains uncertain:** Documented limitations (dynamic imports, unexecuted checks, missing tests).

### Outcomes:
- `REGRESSION_OBSERVED`: Comparable checks pass on baseline and fail after upgrade.
- `POTENTIAL_IMPACT`: Source/API evidence indicates possible incompatibility, but execution does not establish a regression.
- `NO_REGRESSION_OBSERVED`: Executed comparable checks show no regression. (Not guaranteed safe)
- `INCONCLUSIVE`: Baseline failures, missing checks, infrastructure problems, or unsupported behavior prevent reliable conclusion.

---

## 2. Monorepo Architecture

```
Upgrade-Impact-Verifier/
├── apps/
│   ├── web/               # React + Vite + Tailwind CSS + Lucide
│   ├── api/               # Express + Prisma + Auth + SSE + OpenAPI
│   └── worker/            # BullMQ / Queue Worker + Analysis Engine
├── packages/
│   ├── contracts/         # Shared Zod schemas, types, DTOs, events
│   ├── analyzer/          # TypeScript Compiler/AST export & usage analysis
│   ├── runner/            # Paired execution boundary (Docker / Process / Sandbox)
│   └── config/            # Shared configs
├── fixtures/              # 8 standard verification scenarios
├── infra/                 # Dockerfiles, docker-compose, Render config
├── docs/                  # Architecture, Security, Decisions, Demo, Deployment
├── scripts/               # Fixture evaluation & benchmark scripts
├── render.yaml            # Render Blueprint spec
└── docker-compose.yml     # Local multi-container development
```

---

## 3. Execution Gates

### Gate 1: Workspace & Tool Inspection, Architecture Decisions (CURRENT)
- [x] Inspect workspace and git configuration.
- [x] Create `.gitignore`, `.env.example`, `docs/DECISIONS.md`.
- [x] Create `IMPLEMENTATION_PLAN.md`, `PROGRESS.md`, `VERIFICATION.md`.
- [ ] Initialize root `package.json`, TypeScript configs, workspace links.

### Gate 2: Database, Authentication, and Protected API
- [ ] Prisma schema with models: `User`, `Session`, `Project`, `Analysis`, `AnalysisAttempt`, `AnalysisEvent`, `Finding`, `Evidence`, `Execution`, `Artifact`.
- [ ] Argon2id password hashing + secure HttpOnly cookies + CSRF tokens.
- [ ] Auth endpoints: register, login, logout, me, password change.
- [ ] Project and analysis CRUD endpoints with strict user ownership validation.
- [ ] Rate limiting on auth endpoints.

### Gate 3: Real Fixture Vertical Slice
- [ ] Implement fixture scenario 1 (Removed export used by application).
- [ ] Real pipeline run: Register -> Login -> Create fixture analysis -> Queue job -> Process -> Display Report.
- [ ] Verify data persistence and snapshot immutability.

### Gate 4: GitHub Ingestion & Version Resolution
- [ ] Ingestion service supporting:
  - GitHub PR URLs (`https://github.com/owner/repo/pull/123`).
  - Repository URL + dependency name + target version.
- [ ] Merge base calculation and single-dependency update validation.
- [ ] Validation: reject multi-dependency changes, unrelated source edits, unsupported package managers, monorepos.

### Gate 5: AST/API Analysis & Evidence Tracking
- [ ] `packages/analyzer`:
  - Static import scanner: named, default, aliased, namespace, common require.
  - Export diffing: removed exports, changed parameter types/arities.
  - AST usage location mapping with line numbers and bounded code snippets.
  - Traceable evidence creation linking findings to releases and code snippets.

### Gate 6: Paired Execution & Outcome Classification
- [ ] `packages/runner`:
  - Baseline workspace run vs Upgrade workspace run.
  - Script discovery: `test`, `build`, `typecheck` / `type-check`.
  - Non-interactive execution with timeouts, resource bounds, offline check enforcement.
  - Result comparison logic and 4-outcome classifier.

### Gate 7: Optional Gemini Enrichment
- [ ] Server-side Gemini adapter with structured JSON schema outputs.
- [ ] Release note interpretation and symbol association.
- [ ] Fallback to deterministic analysis if credentials missing or AI disabled.
- [ ] Secret redaction and prompt token budgeting.

### Gate 8: Complete Frontend, History, Exports & Settings
- [ ] Dashboard with real analysis counts and recent runs.
- [ ] New analysis submission forms (PR URL mode & manual mode + fixture quick launches).
- [ ] Live progress view with real-time SSE event streaming and reconnection.
- [ ] Comprehensive Report view with tabs: Summary, Affected Code, Dependency Changes, Checks, Evidence, Logs, Limitations.
- [ ] JSON and Markdown exports, rerun action, printable layout.
- [ ] History view with search, filter, pagination.
- [ ] Settings view showing service health, integrations, password change.

### Gate 9: Reliability, Isolation Checks, and Automated Tests
- [ ] All 8 fixture scenarios implemented and verified with evaluation script:
  1. Removed export used by application -> `REGRESSION_OBSERVED`
  2. Changed required argument detected by type checking -> `REGRESSION_OBSERVED`
  3. Compatible update -> `NO_REGRESSION_OBSERVED`
  4. Baseline already failing -> `INCONCLUSIVE`
  5. Missing tests -> `NO_REGRESSION_OBSERVED` (with limitation note)
  6. Timeout -> `INCONCLUSIVE`
  7. Cancellation -> `CANCELLED`
  8. Removed export that application never uses -> `NO_REGRESSION_OBSERVED` (usage-aware proof)
- [ ] Unit tests, integration tests, E2E tests with Vitest.

### Gate 10: Production Build, Documentation & Verified Local Startup
- [ ] Production build of web, api, and worker.
- [ ] Local startup on `http://localhost:3000` (web) and `http://localhost:4000` (api).
- [ ] Complete documentation: `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DEMO.md`, `DEPLOYMENT.md`.

### Gate 11: Push to Specified GitHub Repository
- [ ] Commit all code, tests, documentation, and configs to `main`.
- [ ] Push to `https://github.com/anilkumargadi27-hub/Upgrade-Impact-Verifier.git`.
- [ ] Verify remote commit SHA matches local release.

### Gate 12: Render Services, Migrations, and Hosted Runner Operational
- [ ] Configure `render.yaml` with Web Service, Worker, PostgreSQL, and Key Value.
- [ ] Deploy and verify database migrations.
- [ ] Check worker logs and service connectivity.

### Gate 13: End-to-End Verification through Public URL
- [ ] Verify public HTTPS URL in browser.
- [ ] Test registration, login, fixture execution, GitHub ingestion, and export downloads.
- [ ] Verify zero runtime dependency on localhost or laptop.

### Gate 14: Final Release Documentation & Handoff
- [ ] Output verified public URL, GitHub repository link, release SHA, demonstration steps, and verification report.
