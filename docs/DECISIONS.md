# Architectural Decision Records (ADRs) - UpgradeLens

## ADR-001: Monorepo Architecture with npm Workspaces
- **Status:** Accepted
- **Context:** The application consists of frontend (`apps/web`), backend API (`apps/api`), queue worker (`apps/worker`), shared schemas (`packages/contracts`), AST analysis engine (`packages/analyzer`), execution boundary (`packages/runner`), and test fixtures (`fixtures/`).
- **Decision:** Use standard npm workspaces (`apps/*`, `packages/*`). Avoid introducing heavy additional monorepo tooling to keep dependencies lightweight and robust across environments (Windows, Linux, CI, Render).
- **Consequences:** All shared code is typed with TypeScript project references or direct path imports. Clean build boundaries and single root lockfile.

## ADR-002: Evidence Model & Outcome Classification
- **Status:** Accepted
- **Context:** The core value of UpgradeLens is answering: *"If I upgrade this dependency, which parts of my application could break, and what evidence supports that conclusion?"*
- **Decision:** Separate findings into:
  - (A) What changed in the dependency (AST diff, removed exports, signature changes).
  - (B) Where the application uses the affected API (AST usage scanning).
  - (C) What the checks actually observed (baseline vs upgrade test, typecheck, build comparison).
  - (D) What remains uncertain (limitations, dynamic imports, flakiness).
  Outcomes strictly map to: `REGRESSION_OBSERVED`, `POTENTIAL_IMPACT`, `NO_REGRESSION_OBSERVED`, `INCONCLUSIVE`.
  Never invent artificial percentages or uncalibrated confidence scores.

## ADR-003: Database with PostgreSQL, Prisma & Dual-Engine Capability
- **Status:** Accepted
- **Context:** Render provides managed PostgreSQL. Local Windows host lacks Docker and native Postgres service.
- **Decision:** Use Prisma ORM with PostgreSQL schema. For production and Docker environments, standard PostgreSQL connection is used. For local development or environments without an external Postgres server, support `@electric-sql/pglite` (WebAssembly Postgres running inside Node.js with real Postgres SQL dialect and persistence) via driver adapter.
- **Consequences:** Schema, relations, indexes, and queries remain 100% PostgreSQL compliant everywhere with zero dialect drift.

## ADR-004: Queue Architecture (BullMQ & Local Fallback)
- **Status:** Accepted
- **Context:** Worker runs asynchronous pipeline across 14 explicit states. Production on Render uses Render Key Value (Redis) + BullMQ.
- **Decision:** Implement a typed `QueueAdapter` interface. In production (when `REDIS_URL` is set), use real `BullMQ` with Redis. When `REDIS_URL` is unset or unavailable locally, use a BullMQ-compatible in-process queue adapter that supports the exact same lifecycle (idempotent submission, attempt tracking, concurrency limiting, cancellation, event streaming, recovery).
- **Consequences:** Tests and local dev can run without requiring an external Redis daemon, while production runs on scalable Redis + BullMQ.

## ADR-005: Runner Isolation Boundary
- **Status:** Accepted
- **Context:** Untrusted repository code must never run in the API server process or mutate host checkout.
- **Decision:** Create a pluggable runner abstraction:
  - `DockerRunner`: Containerized non-root execution with dropped capabilities, read-only root, no host networking, strict memory/cpu/time limits.
  - `RenderSandboxRunner`: Provider sandbox API adapter.
  - `IsolatedProcessRunner`: Bounded local execution in isolated temp directories with sanitized environment (strips tokens, secrets, parent env), memory/process monitoring, offline network isolation flags (`npm --offline` / cache-only during checks), and strictly captures stdout/stderr.
- **Consequences:** Consistent execution contracts across local dev, CI, and hosted cloud.

## ADR-006: Server-Side Authentication & Session Security
- **Status:** Accepted
- **Context:** User ownership across projects, analyses, and downloads is mandatory.
- **Decision:** Use Argon2id for password hashing, server-side sessions with cryptographic session IDs, HttpOnly SameSite=Lax (or Strict) cookies, CSRF protection, and rate limiting on auth endpoints. No JWTs or secrets stored in browser localStorage.

## ADR-007: Optional Server-Side Gemini Adapter
- **Status:** Accepted
- **Context:** AI enrichment should interpret release notes, associate symbols, and suggest migration steps without hallucinating facts.
- **Decision:** Strict fallback to deterministic analysis when `AI_ENABLED=false` or no `GEMINI_API_KEY`. When enabled, use structured JSON schema output, input token budgets, secret redaction, and never allow AI output to override observed execution facts or invent raw evidence.
