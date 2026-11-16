# UpgradeLens Deployment Guide

**Product Name:** UpgradeLens  
**Project Owner:** G. Anil Kumar  

UpgradeLens supports continuous deployment on **Render**, **Docker Compose**, and **Kubernetes/Cloud VMs**.

---

## 1. Deploying on Render (Recommended)

UpgradeLens includes a production-ready `render.yaml` blueprint.

### Automatic Blueprint Deployment
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **Blueprints** -> **New Blueprint Instance**.
3. Connect your GitHub repository:
   `https://github.com/anilkumargadi27-hub/Upgrade-Impact-Verifier`
4. Render automatically configures:
   - **`upgradelens-web`**: Web Service running the API + React SPA.
   - **`upgradelens-worker`**: Background worker processing the BullMQ queue.
   - **`upgradelens-db`**: Managed PostgreSQL database.
   - **`upgradelens-redis`**: Managed Redis Key-Value store.
5. Click **Apply**.
6. Once deployed, Render provides your public URL:
   `https://upgradelens-web.onrender.com`

### Environment Variables on Render
| Variable | Description |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `10000` (Render default) |
| `DATABASE_URL` | Auto-populated by Render PostgreSQL |
| `REDIS_URL` | Auto-populated by Render Redis |
| `SESSION_SECRET` | Auto-generated cryptographic random key |
| `RUNNER_TYPE` | `process` |
| `AI_ENABLED` | Set `true` to enable optional Gemini enrichment |
| `GEMINI_API_KEY` | Optional Google AI Studio API key |

---

## 2. Deploying with Docker Compose

For self-hosted virtual machines (AWS EC2, DigitalOcean, Hetzner, GCP):

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
  - Returns `200 OK` with database connection state and queue mode.
- **System Capabilities:** `GET /api/system/settings`
- **OpenAPI Specification:** `GET /api/docs/openapi.json`