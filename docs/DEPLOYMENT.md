# UpgradeLens Deployment Guide

**Product Name:** UpgradeLens  
**Project Owner:** G. Anil Kumar  

UpgradeLens supports continuous deployment on **Render**, **Docker Compose**, and **Cloud VMs**.

---

## 1. Deploying on Render (Free Tier Blueprint)

UpgradeLens includes a production-ready, 100% free-tier compliant `render.yaml` blueprint.

### Architecture on Render
- **`upgradelens-web` (Web Service - Free Plan):**
  - Serves the compiled production React SPA frontend.
  - Handles the REST API endpoints and SSE live events.
  - Automatically activates the in-process queue processor (`InProcessQueueService`), running analysis jobs directly on Render without needing a paid background worker instance.
- **`upgradelens-db` (PostgreSQL Database - Free Plan):**
  - Managed PostgreSQL database created by Render.
  - Schema is automatically migrated on build via `prisma db push`.

### Step-by-Step Blueprint Deployment
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository:
   `https://github.com/anilkumargadi27-hub/Upgrade-Impact-Verifier`
4. Render automatically parses `render.yaml` and displays:
   - Web Service: `upgradelens-web` (Free tier)
   - Database: `upgradelens-db` (Free tier)
5. Click **Apply**.
6. Once deployment finishes, Render provides your public HTTPS URL:
   `https://upgradelens-web.onrender.com`

---

## 2. Deploying with Docker Compose

For local testing with native PostgreSQL and Redis:

```bash
# 1. Clone repository
git clone https://github.com/anilkumargadi27-hub/Upgrade-Impact-Verifier.git
cd Upgrade-Impact-Verifier

# 2. Configure environment
cp .env.example .env

# 3. Start containers
docker compose up --build -d

# 4. View running services
docker compose ps

# 5. Access website at http://localhost:4000
```

---

## 3. Production Health & Monitoring

- **Readiness / Liveness Probe:** `GET /api/health`
- **System Capabilities:** `GET /api/system/settings`
- **OpenAPI Specification:** `GET /api/docs/openapi.json`