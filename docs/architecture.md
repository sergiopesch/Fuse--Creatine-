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
Web UI (View Layer — ceo-dashboard.html, agents.html)
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
- `ceo-auth.js` — CEO authentication
- Supporting libraries in `api/_lib/`

### Web UI

- `index.html` — Marketing landing page
- `ceo-dashboard.html` — CEO executive dashboard
- `agents.html` — Agent Command Center
- `dashboard.html` — Company dashboard
- `admin.html` — Admin analytics

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

| Layer | Technology |
|-------|-----------|
| CLI | TypeScript, Commander.js, chalk |
| Frontend | Vanilla JS, CSS3, HTML5, GSAP |
| Backend | Vercel Serverless (Node.js 18+) |
| Storage | Upstash Redis, Vercel Blob |
| AI | Anthropic Claude API |
| Auth | WebAuthn passkeys |
| Hosting | Vercel |
| Source Control | GitHub |
