# UpgradeLens Demonstration & Walkthrough Guide

**Product Name:** UpgradeLens  
**Project Owner:** G. Anil Kumar  

This guide provides a step-by-step walkthrough for evaluating UpgradeLens locally or on a deployed instance.

---

## 1. Quick Tour & Feature Highlights

1. **Sign Up / Log In**
   - Register a developer account with email and password (min 8 characters).
   - Passwords are securely hashed with Argon2id; session stored via HttpOnly cookie.

2. **Explore the Dashboard**
   - Live metrics summary: Regressions, Potential Impacts, Clean updates, and Inconclusive runs.
   - Quick launch cards for pre-packaged ground-truth test scenarios.
   - Recent analyses table with real-time status badges.

3. **Launch an Interactive Fixture Scenario**
   - On the Dashboard or "New Analysis" page, select **"Built-in Fixture Demonstrations"**.
   - Click **"Run Scenario"** on `scenario-1` (*Removed export used by application*).
   - Observe real-time SSE progress events transition through all 14 pipeline stages in the live terminal.
   - When completed, click **"View Verified Report"**.

4. **Inspect the Comprehensive Verification Report**
   - **Executive Overview:** The 4 pillars of credible evidence (A: What changed, B: Where used, C: Checks observed, D: Uncertainties).
   - **Affected Application Code:** Exact file path, line numbers, and syntax-highlighted code snippet showing the breaking call site.
   - **Pairwise Check Comparison:** Baseline vs Upgrade comparison table highlighting the exact check that regressed (`PASS` -> `FAIL`).
   - **Dependency API Differences:** Raw declaration diffs extracted from `.d.ts`.
   - **Audit & Reproducibility:** Exact baseline/target lockfile hashes, commit SHAs, and execution settings.
   - **Export Options:** Click **Markdown** or **JSON** to download the complete report snapshot.

5. **Test Usage Awareness (`scenario-8`)**
   - Run `scenario-8` (*Removed export that the application never uses*).
   - Even though the library removed an export, notice that UpgradeLens reports **`NO_REGRESSION_OBSERVED`** with 0 findings because the application does not reference the removed symbol.

6. **Submit a Real GitHub Pull Request**
   - Navigate to "New Analysis" -> "GitHub Pull Request".
   - Enter a public GitHub PR URL updating a single direct npm dependency (e.g., Dependabot or Renovate PR).
   - UpgradeLens ingests the PR diff, validates boundaries, and queues the verification run.

7. **System & Account Settings**
   - Navigate to "Settings" to inspect runtime capabilities: PostgreSQL connection, BullMQ queue status, and Gemini AI integration.
   - Test password rotation using the Change Password form.