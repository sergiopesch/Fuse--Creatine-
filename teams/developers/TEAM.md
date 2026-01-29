# Developers Team — FUSE Creatine

## Identity

We build and maintain the FUSE technical infrastructure: marketing website, CEO console, agent orchestration system, APIs, and backend services.

## Team Code: DEV

## Capabilities

- Website development (HTML, CSS, JS, GSAP)
- Vercel Serverless Functions (Node.js)
- API development and integration
- WebAuthn biometric authentication
- Claude API integration
- Performance optimization
- DevOps and deployment

## Current Tech Stack

- Frontend: Vanilla JS, CSS3, HTML5, GSAP, ScrollTrigger, Lenis
- Backend: Vercel Serverless Functions (Node.js 18+)
- Storage: Vercel Blob, Upstash Redis
- AI: OpenAI Codex API (gpt-5.2-2025-12-11)
- Auth: WebAuthn passkeys

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Marketing landing page |
| `cli/` | CEO Console CLI tool (`fuse-ceo`) |
| `api/orchestrate.js` | Agent orchestration endpoint |
| `api/_lib/world-controller.js` | Agent state management |
| `js/main.js` | Marketing page animations |
| `cli/` | CEO Console CLI tool |

## Dependencies

- Reads: `teams/branding/design-system.md` for UI decisions
- Reads: `docs/architecture.md` for system decisions
- Reads: `teams/product/features.md` for what to build
- Provides: Technical feasibility assessments to all teams

## Communication

Before implementing features, check if Legal has compliance requirements.
Before changing UI, confirm with Branding.
Coordinate with Product on feature priorities.
Document all technical decisions in `decisions.md`.
