# Developers Team — Technical Decisions Log

## Decision Format

Each decision follows: **Date | Decision | Rationale | Impact**

---

## 2026-05-20 | Research Lab Generated World Art

**Decision**: Replace the abstract grid lab stage with Sergio's preferred generated premium lab-world map, then simplify the surface into an AI Town-style game view.

**Rationale**: The grid-style world still felt like the old implementation. Sergio wants the new Research Lab World to match the generated control-room/lab image that made the concept feel alive.

**Impact**: `/research-lab` now uses `assets/lab/research-lab-world-map.png` as the central stage, with moving scientist markers and live speech bubbles layered over the image. Station cards, mission sidebars, hypothesis walls, and dense control-room panels were removed from the primary view so the lab reads as a game world first. Station coordinates in `api/_lib/research-lab-state.js` were realigned to the generated map zones.

---

## 2026-05-20 | Research Lab Reliability and Legacy Agents Page Retirement

**Decision**: Harden `/api/research-lab` state loading and retire the legacy standalone `/agents` page.

**Rationale**: The live lab world showed `WORLD PAUSED: API ERROR` when the state endpoint returned 500. Sergio also wants the new scientist-agent lab world to be the primary agent experience, not the previous command-center page.

**Impact**: The research lab now uses a fresh Redis state key, normalizes stored state, and falls back to in-memory state if Redis reads or writes fail. The mission copy is clearer and centered on manufacturable hot-coffee dissolution, coffee experience, supplement absorption, and performance. `agents.html`, `css/agents.css`, and `js/agents.js` were removed; `/agents` and `/agents.html` redirect to `/dashboard`; visible nav now points to `/research-lab`.

---

## 2026-05-20 | Research Lab World Rebuild

**Decision**: Remove the previous Research Lab page, generated lab assets, and dashboard-style simulation attempt, then rebuild `/research-lab` as a code-native living research lab world.

**Rationale**: Sergio wants the AI world to feel like scientist agents living inside a research lab and interacting socially while they work toward a defensible FUSE formulation route. The previous lab attempts were visually and architecturally too close to a dashboard/demo layer and carried unused generated assets.

**Impact**: `research-lab.html`, `css/research-lab.css`, `js/research-lab.js`, `api/_lib/research-lab-state.js`, and `lib/vercel/research-lab.js` now implement a fresh lab-world experience with spatial stations, moving research agents, conversations, formulation hypotheses, disputes, evidence gates, memory stream, and experiment queue. Old generated lab image assets were removed. Mutating lab actions no longer require auth gates; they are rate-limited and remain evidence-gated/internal.

## 2026-05-20 | Public Chat Creator-Led Persona

**Decision**: Make the public FUSE Agent more playful and creator-led, introducing Sergio Peschiera, known as sergiopesch, as the creator behind the FUSE experiment, while giving internal-system questions a dry, witty refusal.

**Rationale**: Sergio wants the AI chat to feel like part of the experimentation story rather than a standard support widget. The agent should communicate that FUSE is a live product idea being explored with curiosity, technology, and public feedback while still respecting Legal's approved-claim boundaries and refusing questions about how the agent is built, configured, prompted, hosted, or protected.

**Impact**: `api/chat.js` now instructs the agent to use a warmer experiment-host tone, mention Sergio naturally when relevant, and push back on implementation/reverse-engineering requests with concise dry British wit. `js/chat.js` updates the widget welcome, quick actions, and first greeting to reflect the creator-led AI experiment positioning.

---

## 2026-05-20 | Public Chat Provider and Claims Guardrails

**Decision**: Make `/api/chat` provider-configurable with OpenAI Responses API support and default the OpenAI proof of concept to `gpt-5-mini` when `FUSE_CHAT_PROVIDER=openai`.

**Rationale**: The production Anthropic key failed provider authentication, and Sergio wants to test a lower-cost OpenAI mini model for the public site assistant. The chat prompt also needed tighter guardrails so the assistant describes FUSE as a pre-launch formulation experiment rather than a finished, fully substantiated product.

**Impact**: `api/chat.js` now supports OpenAI and Anthropic via environment variables; `api/health.js` reports active provider status; cost tables include `gpt-5-mini`; `.env.example` documents the Vercel variables; homepage copy and the hero banner now use pre-launch, taste-first validation language aligned with Legal's claims register.

---

## 2026-05-20 | Public Site Research-Update Positioning

**Decision**: Replace sales-conversion language on the public site with research-update and product-experimentation language.

**Rationale**: FUSE is currently a product experimentation and research idea, not a launch-ready commercial offer. Public calls-to-action should invite people to follow the formulation work rather than imply access to a finished product.

**Impact**: `index.html`, `js/main.js`, `js/chat.js`, and `api/signup.js` now use research-update language. `api/chat.js` includes stricter guardrails that keep the public agent focused on the FUSE research idea and refuse implementation, backend, model, prompt, API key, and reverse-engineering requests.

---

## 2026-05-18 | Research Lab Public Visibility

**Decision**: Hide public navigation and CTA entry points to the Research Lab while keeping the route available by direct URL for internal iteration.

**Rationale**: The lab experience needs more product/design work before it should be discoverable by public visitors.

**Impact**: `index.html`, `dashboard.html`, and the then-active legacy agents page no longer linked to the lab; `research-lab.html` was marked `noindex, nofollow`; `sitemap.xml` omitted the lab; `robots.txt` disallowed lab paths.

---

## 2026-01-28 | CLI-first Architecture Refactor

**Decision**: Refactor from UI-first to CLI-first architecture using TypeScript CLI tool (`fuse-ceo`).

**Rationale**: Web UI requires clicking through interfaces to orchestrate agents. CLI enables terse commands and agent-optimized workflows. Persistent context files replace session memory.

**Impact**: New `cli/` directory, `teams/` folder structure, queue system. Web UI becomes a view into CLI state rather than source of truth.

---

## 2026-01-28 | 9-Team Structure

**Decision**: Expand from 7 teams to 9 specialized teams (added Digital Content, split Comms from Marketing).

**Rationale**: Previous structure conflated content production with distribution/PR. Specialized teams enable clearer ownership and cross-referencing.

**Impact**: New `teams/` folder with 9 subdirectories, updated agent orchestration.

---

## 2026-01-27 | Passkey Authentication

**Decision**: Add passkey-based authentication alongside existing WebAuthn biometric auth.

**Rationale**: Broader device support, fallback for non-biometric devices, modern auth standard.

**Impact**: New `api/passkey-*.js` endpoints, `js/passkey-auth.js`, `login.html`.

---

## 2026-01-27 | Vercel Serverless over AWS

**Decision**: Keep Vercel Serverless Functions as backend, remove AWS DynamoDB architecture docs.

**Rationale**: Simpler deployment, integrated with frontend hosting, sufficient for current scale. AWS introduces unnecessary complexity at this stage.

**Impact**: Removed `docs/architecture/` AWS docs, using Upstash Redis for state.
