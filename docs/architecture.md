# Architecture — FUSE Creatine

## System Overview

FUSE Creatine operates as a CLI-first, agent-optimized architecture where the CEO (Sergio) interfaces with Claude as the orchestration layer, coordinating 9 specialized teams.

```
CEO (Sergio)
  ↓
fuse-ceo CLI
  ↓
Claude (Orchestration Layer)
  ↓
9 Teams (teams/ folder)
  ↓
queue/ (Task Management)
  ↓
Web UI (View Layer — dashboard.html, research-lab.html)
```

## Design Principles

1. **CLI-first**: Every orchestration action starts as a CLI command. Web UI is a view into CLI state, not the source of truth.
2. **Design for agents**: Codebase structured for Claude to navigate efficiently. Obvious folder names, predictable patterns.
3. **Docs over memory**: Teams maintain `context.md` with current state. Claude reads these before acting.
4. **Queue, don't orchestrate**: Simple task queue. CEO adds tasks, agents process them.
5. **Cross-reference within project**: Teams reference each other's work via markdown files.

## Components

### CLI (`cli/`)

TypeScript-based CLI tool (`fuse-ceo`) with commands:

- `status` — Team status overview
- `report` — Daily/weekly reports
- `task` — Add tasks to queue
- `queue` — Manage task queue
- `brief` — Full team context dump
- `sync` — Git commit and push
- `research` — Search research documents

### Teams (`teams/`)

9 specialized team directories, each containing:

- `TEAM.md` — Team identity, capabilities, dependencies
- `context.md` — Current state, priorities, blockers
- Additional team-specific documents

### Queue (`queue/`)

JSON-based task queue:

- `pending.json` — Tasks waiting to be started
- `active.json` — Tasks currently in progress
- `completed.json` — Completed tasks with outcomes

### API (`api/`)

Vercel Serverless Functions:

- `orchestrate.js` — Claude-powered agent orchestration
- `chat.js` — FUSE Agent chat interface
- `agents.js` — Agent management
- Supporting libraries in `api/_lib/`

### Web UI

- `index.html` — Marketing landing page
- `dashboard.html` — Company dashboard (biometric-protected)
- `research-lab.html` — Living research lab world with moving scientist agents, social conversations, formulation hypotheses, disputes, evidence gates, memory stream, and experiment queue
- `admin.html` — Admin analytics

> **Note:** The CEO dashboard web UI has been replaced by the `fuse-ceo` CLI (`cli/`).

### Research (`research/`)

Scientific and market research:

- `science/` — Creatine stability, bioavailability, encapsulation
- `content/` — Content strategy
- `testing/` — Lab validation
- `validation/` — Market validation, patent landscape

## Data Flow

### Task Lifecycle

```
CEO adds task → queue/pending.json
Agent picks up → queue/active.json
Work completed → queue/completed.json
Context updated → teams/<team>/context.md
Changes pushed → git commit + push
```

### Cross-Team Communication

Teams communicate via shared markdown files:

- Legal's `claims-register.md` is read by Marketing, Digital Content, Comms
- R&D's `formulation.md` is read by Product, Sales
- Comms' `messaging.md` is read by Digital Content, Branding

## Technology Stack

| Layer          | Technology                                                                                |
| -------------- | ----------------------------------------------------------------------------------------- |
| CLI            | TypeScript, Commander.js, chalk                                                           |
| Frontend       | Vanilla JS, CSS3, HTML5, GSAP                                                             |
| Backend        | Vercel Serverless (Node.js 18+)                                                           |
| Storage        | Upstash Redis, Vercel Blob                                                                |
| AI             | OpenAI Responses API for public chat POC; Anthropic Claude API for orchestration/fallback |
| Auth           | WebAuthn passkeys                                                                         |
| Hosting        | Vercel                                                                                    |
| Source Control | GitHub                                                                                    |

## Research Lab World

The FUSE Research Lab World is a Vercel-hosted, evidence-gated agent world. It keeps the existing lightweight FUSE stack while adopting AI Town-style product behaviour: agents live in a spatial lab, move between workstations, talk when their work overlaps, form memories, surface disputes, and keep public claims behind evidence gates.

The frontend is `research-lab.html`, `css/research-lab.css`, and `js/research-lab.js`. The `/api/research-lab` route is routed through the consolidated orchestrator endpoint and backed by `api/_lib/research-lab-state.js`.

Each tick updates:

- scientist agent positions, current intent, selected-agent needs, and reflections
- formulation hypothesis scores across dissolution, taste, mouthfeel, dose, heat, manufacturability, and claims safety
- social conversations between relevant agents
- active formulation disputes and evidence gate status
- memory stream entries with importance scores
- next experiment queue

The lab now ports the useful parts of StanfordHCI's `genagents` model into the current Node/Vercel stack rather than adding a separate Python/Godot service. Each scientist has a scratch identity, retrieves memory nodes using a recency/importance/relevance score, writes structured action and observation memories, forms deterministic reflection memories when recent importance crosses threshold, and compiles a short hierarchical plan before acting. Lab objects expose explicit affordances such as chamber temperature/RPM and analysis-console readouts, and each tick produces internal batch telemetry for dissolution seconds, grit score, dose uniformity, taste cleanliness, and a non-public bioavailability index.

Daily discovery is handled by `/api/research-lab-daily`, protected by `CRON_SECRET` in production and scheduled in `vercel.json` at `0 7 * * *`. The cron advances the lab through three autonomous discovery ticks, then runs a single OpenAI Responses API synthesis pass when `OPENAI_API_KEY` is present and `FUSE_LAB_AI_ENABLED` is not `false`. The default lab model is `FUSE_LAB_AI_MODEL`, falling back to `FUSE_CHAT_MODEL`, then `gpt-5-mini`. Browser auto-ticks remain deterministic so the page cannot accidentally create runaway model spend. If OpenAI is unavailable, the daily endpoint writes a deterministic fallback discovery instead.

The model-backed daily synthesis returns a structured JSON brief: headline, top insight, per-agent findings, next physical test, ranked actions, risk, Sergio decision needed, leading route, four formulation scorecards, and simulation replay beats. The brief is written back into the memory stream as an internal reflection.

The formulation board compresses hypotheses, batch telemetry, Legal/IP blockers, and the latest synthesis into four scorecards: dissolution speed, taste neutrality, manufacturing path, and Legal/IP safety. The same daily output provides a station-by-station discovery replay, which `/research-lab` renders as replay beacons and a compact beat list so the moving scientist characters can visualize how the latest finding was reached.

Before spending a daily model call, the lab calculates a progress assessment from formulation score movement, batch telemetry, blocked evidence gates, Sergio decision signals, and next-test clarity. `labControls.progressDrivenSynthesis` and `labControls.progressSignalThreshold` determine whether the model call is recommended. If signals are below threshold, the daily cycle still advances deterministic ticks and records a progress digest without model spend.

Weekly development readiness is handled by `/api/research-lab-weekly`, scheduled at `0 8 * * 1`. It uses `FUSE_LAB_WEEKLY_MODEL`, defaulting to `gpt-5.5`, with `FUSE_LAB_WEEKLY_REASONING=high` by default. This weekly pass is the expensive strategic review: continue, pause, pivot, or kill; readiness score; evidence for/against; required real-world tests; legal/manufacturing risk; next spend decision; and Sergio decision needed. It also writes back to the memory stream as an internal development review. These outputs remain internal simulation hypotheses until R&D wet-lab work and Legal claims review upgrade them.

Admin control is exposed through `/api/research-lab-admin`, protected by signed admin sessions or the legacy `ADMIN_TOKEN`, and surfaced in the admin console's AI Lab Control tab. The backend door can enable or disable scheduled daily/weekly cycles, enable or disable OpenAI synthesis, set daily/weekly model names and weekly reasoning effort, run one deterministic world tick, run the daily cycle manually, or run the weekly GPT-5.5 review manually. Manual runs use `force: true`, so Sergio can run a cycle even when scheduled automation is paused.

Admin login is passkey-first through `/api/admin-passkey`. The admin page signs in with a WebAuthn passkey and receives an eight-hour signed bearer session accepted by admin APIs. `ADMIN_USERNAME=sergiopesch`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET` remain Vercel environment variables; the password hash is only used to create or recover an admin passkey. Password hashes use the local helper `node scripts/generate-admin-password-hash.js "<password>"`. Admin passkey credentials persist in Upstash Redis through `UPSTASH_REDIS_KV_REST_API_URL` and `UPSTASH_REDIS_KV_REST_API_TOKEN`, with in-memory fallback for local development. `/api/admin-login` no longer issues password sessions. `ADMIN_TOKEN` remains as a legacy direct-API fallback for scripts and emergency access.

The lab world has no auth or music-generation layer. It remains `noindex` and internal-facing; outputs are hypotheses until R&D and Legal upgrade them with wet-lab evidence and claims review.
