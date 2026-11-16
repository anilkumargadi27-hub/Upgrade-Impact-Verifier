# UpgradeLens Architecture & Design

**Product Name:** UpgradeLens  
**Project Owner:** G. Anil Kumar  
**Mission:** Provide evidence-backed answers to: *“If I upgrade this dependency, which parts of my application could break, and what evidence supports that conclusion?”*

---

## 1. System Overview

UpgradeLens separates the evaluation of a dependency upgrade into two complementary methodologies:
1. **Static AST Analysis**: Discovers public declaration changes (exports removed, signatures changed) and scans application source code for direct usages.
2. **Dynamic Isolated Execution**: Runs identical check commands (`npm run build`, `npm run typecheck`, `npm test`) on both the clean baseline revision and the upgraded workspace to observe tangible runtime and compiler differences.

```
                  +-----------------------------------+
                  |        React SPA Dashboard        |
                  |     (Vite + Tailwind + SSE)       |
                  +-----------------+-----------------+
                                    | HTTP / SSE
                                    v
                  +-----------------------------------+
                  |         Express REST API          |
                  |  (Auth, Projects, Analyses, DB)   |
                  +--------+-----------------+--------+
                           |                 |
                Jobs Enqueued                | Reads State
                           v                 v
            +----------------------+   +-------------------+
            |  Queue Adapter       |   | Dual-Mode DB      |
            | (BullMQ / In-Process)|   | (PG / PGlite)     |
            +----------+-----------+   +---------+---------+
                       |                         |
               Jobs Dispatched                   |
                       v                         |
            +----------------------+             |
            |   Analysis Worker    |-------------+
            |  (14-Stage Pipeline) |
            +----------+-----------+
                       |
        +--------------+--------------+
        |                             |
        v                             v
+---------------+             +---------------+
| AST Analyzer  |             | Process-Tree  |
| (TypeScript)  |             | Runner        |
+---------------+             +---------------+
```

---

## 2. Monorepo Organization

- **`apps/web`**: Single Page Application built with React 18, Vite 6, and Tailwind CSS. Provides route navigation, real-time SSE progress streaming, pairwise check comparison tables, code snippet displays, and report exports.
- **`apps/api`**: Express server exposing OpenAPI-compliant routes for authentication, project tracking, analysis lifecycle, and SSE event dispatching.
- **`apps/worker`**: Background service executing the 14-stage orchestrator, GitHub PR ingestion, and optional Gemini structured explanations.
- **`packages/contracts`**: Single source of truth containing Zod schemas, TypeScript types, and DTOs shared between web, api, and worker.
- **`packages/analyzer`**: TypeScript compiler API scanner that extracts export declarations, compares `.d.ts` interfaces, and searches application source files for AST import and call sites.
- **`packages/runner`**: Sandboxed process runner with tree-kill capabilities (`taskkill /pid ... /f /t` on Windows, process groups on POSIX) and strict runtime limits.
- **`fixtures`**: 8 pre-packaged ground-truth scenarios for end-to-end regression validation.

---

## 3. The 14-Stage Orchestrator Pipeline

Every analysis transitions deterministically through 14 distinct stages:
1. `queued`: Analysis job inserted into queue and acquired by worker.
2. `fetching`: Repository cloned or baseline fixture retrieved.
3. `validating`: Monorepo check, package manager verification, single-dependency diff assertion.
4. `extracting_changes`: Dependency baseline and target declarations extracted and diffed.
5. `scanning_usage`: Application source files AST scanned for usages of the target package.
6. `preparing_runs`: Isolated baseline and upgraded workspaces created in temp directories.
7. `running_baseline`: Baseline checks executed (`build`, `typecheck`, `test`).
8. `running_upgrade`: Upgraded workspace checks executed.
9. `comparing`: Pairwise execution matrix analyzed.
10. `generating_report`: Immutable report snapshot assembled.
11. `enriching` (optional): Gemini AI structured explanation synthesized.
12. `completed`: Final immutable state saved to database.
13. `failed`: Execution terminated due to unhandled error or validation rejection.
14. `cancelled`: Prematurely terminated upon explicit user request.

---

## 4. Dual-Mode Architecture

To guarantee zero setup friction for evaluators while providing production scalability on cloud platforms:

### Database:
- **Local Environment:** Connects automatically to `@electric-sql/pglite` embedded WebAssembly PostgreSQL driver using `pglite-prisma-adapter`. No local Postgres server installation needed.
- **Production Environment:** Connects directly to PostgreSQL connection string (`DATABASE_URL`).

### Queue:
- **Local Environment:** Uses `InProcessQueueService` event emitter. No Redis daemon required.
- **Production Environment:** Uses `BullMQQueueService` connected to Redis (`REDIS_URL`).

---

## 5. Usage-Aware Impact Verification

A core design principle of UpgradeLens is **usage awareness**:
- A breaking change in a dependency only generates an application finding if the application actually imports or calls that specific symbol.
- This is empirically demonstrated in `scenario-8`: a library removes an exported function that the application never references; UpgradeLens correctly reports `NO_REGRESSION_OBSERVED` with 0 findings.