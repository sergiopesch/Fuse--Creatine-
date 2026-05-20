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

The lab world has no auth or music-generation layer. It remains `noindex` and internal-facing; outputs are hypotheses until R&D and Legal upgrade them with wet-lab evidence and claims review.
