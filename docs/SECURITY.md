# Security & Boundary Model

**Product Name:** UpgradeLens  
**Project Owner:** G. Anil Kumar  

---

## 1. Authentication & Session Security

- **Argon2id Password Hashing:** User passwords are encrypted with `@node-rs/argon2` (19 MiB memory cost, 2 iterations, 1 parallelism, 32-byte salt).
- **HttpOnly Cookies:** Session tokens are delivered solely via `HttpOnly`, `SameSite=Lax` cookies. JavaScript running in the browser cannot read or exfiltrate session credentials.
- **SHA-256 Database Token Storage:** Raw session tokens are never saved to the database. Only the SHA-256 cryptographic hash is persisted, preventing database dump credential re-use.
- **Session Revocation:** Logout explicitly purges session records and invalidates cookies.
- **Per-User Ownership Guard:** All stored resources (projects, analyses, findings, executions, SSE streams, artifact downloads) enforce ownership verification in middleware:
  ```typescript
  // Example guard from authMiddleware.ts
  if (analysis.userId !== req.user.id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'You do not own this analysis' });
  }
  ```

---

## 2. Execution Isolation & Sandboxing

When analyzing arbitrary repositories and running build or test scripts:
- **Temporary Workspaces:** Repositories are cloned into randomized temporary directories outside the application bundle.
- **Process-Tree Termination:** Subprocesses run under strict timeout limits (default 60s per check). If a process hangs or spawns detached children, process tree termination (`taskkill /pid <PID> /f /t` on Windows, `kill(-PID, SIGKILL)` on Linux) ensures no orphan processes linger.
- **Secret Isolation:** Worker environment variables containing `DATABASE_URL`, `SESSION_SECRET`, or `GEMINI_API_KEY` are stripped before spawning child workspace commands.

---

## 3. Input Validation & Defense-in-Depth

- **Single Direct Dependency Update:** PR ingestion verifies that `package.json` diffs modify exactly one direct production or development dependency. Multi-dependency upgrades or PRs containing arbitrary code changes are rejected.
- **Zod Strict Validation:** All API endpoints validate request bodies, query parameters, and URL arguments using strict Zod schemas.
- **No Arbitrary Command Injection:** Execution commands are strictly constrained to pre-vetted npm script lifecycle commands (`npm run build`, `npm run typecheck`, `npm test`). Arbitrary shell scripts cannot be submitted for execution.

---

## 4. AI Guardrails (Gemini Integration)

- AI suggestions are strictly advisory and classified as synthetic migrations.
- AI is never permitted to alter the raw factual findings extracted by AST parsing or execution exit codes.
- Responses from Gemini are validated against a strict Zod schema before display. If AI service is disabled or encounters an error, the system seamlessly falls back to deterministic AST reporting.