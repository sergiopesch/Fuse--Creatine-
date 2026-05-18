# Developers Team — Technical Decisions Log

## Decision Format

Each decision follows: **Date | Decision | Rationale | Impact**

---

## 2026-05-17 | Research Lab Agent Society Model

**Decision**: Extend the Research Lab tick loop with a deterministic agent-society layer: scored memory stream, active plans, periodic reflections, social graph links, and compact replay frames.

**Rationale**: Generative agent simulations need visible cognition, not just animated sprites. Keeping the model inside the existing Vercel Node state avoids a heavy Python runtime while adopting the strongest patterns from Generative Agents and AgentSociety.

**Impact**: `api/_lib/research-lab-state.js` now emits cognitive state with every lab state response; `research-lab.html`, `css/research-lab.css`, and `js/research-lab.js` render the new society layer and selected-scientist need bars.

---

## 2026-05-17 | Research Lab Sandbox Map

**Decision**: Rework the Research Lab world view from a cinematic lab backdrop into a Generative Agents-style sandbox map with named rooms, corridors, persistent scientist nameplates, route traces, active-room highlighting, and one visible active action bubble.

**Rationale**: The expected experience is closer to the Generative Agents Smallville simulator than a dashboard. The map-first view makes scientists feel like agents living in a world rather than markers on a background.

**Impact**: `research-lab.html`, `css/research-lab.css`, and `js/research-lab.js` now render a walkable FUSE lab map while preserving the existing evidence, formula, memory, and replay panels.

---

## 2026-05-17 | Research Lab Movement and Chat

**Decision**: Add deterministic scientist movement routes and live chat turns between collaborating scientists.

**Rationale**: The lab needs to show agents living in the world, not only standing in rooms. Conversations make handoffs, claims checks, and sample routing visible in the map itself.

**Impact**: `api/_lib/research-lab-state.js` emits `chatMessages`; `js/research-lab.js` renders chat bubbles and route variables; `css/research-lab.css` animates travel and chat pop-in states.

---

## 2026-05-17 | Research Lab Top-Down View

**Decision**: Reframe the Research Lab page as a top-down sandbox-first scene instead of a dashboard with an embedded map.

**Rationale**: Sergio expected the Generative Agents simulator model: the map should be the main object on screen, especially on mobile. Removing the intro from the first viewport and rendering agents as map pawns makes the world easier to understand.

**Impact**: `research-lab.html` adds sandbox-specific hooks; `css/research-lab.css` promotes the map to the first screen, removes perspective-heavy character rendering, and adds mobile-specific room geometry.

---

## 2026-05-17 | Research Lab Photoreal Floor

**Decision**: Make the existing photoreal/isometric lab render the primary sandbox floor and reduce schematic room overlays to transparent interaction zones.

**Rationale**: The desired reference is an open cutaway lab, not a neon blueprint. The raster lab scene provides the correct read immediately, while lightweight labels preserve station identity without obscuring the environment.

**Impact**: `css/research-lab.css` now renders `lab-walkable-floor.png` at high opacity, hides competing schematic textures, and trims labels on mobile; `js/research-lab.js` aligns station coordinates to the new visual floor.

---

## 2026-05-17 | Research Lab Room Palette Consistency

**Decision**: Consolidate room identity into a consistent station palette and exact station names across the lab map and agent UI.

**Rationale**: The sandbox needs stable visual language: an agent attached to a room should keep that room's color everywhere, and labels should not switch between alternate names like “Evidence Archive” and “Absorption Evidence Desk.”

**Impact**: `css/research-lab.css` defines room color tokens; `research-lab.html` uses exact station labels; `js/research-lab.js` derives agent, plan, and selected-scientist colors from the same station theme.

---

## 2026-05-18 | Research Lab Public Visibility

**Decision**: Hide public navigation and CTA entry points to the Research Lab while keeping the route available by direct URL for internal iteration.

**Rationale**: The lab experience needs more product/design work before it should be discoverable by public visitors.

**Impact**: `index.html`, `dashboard.html`, and `agents.html` no longer link to the lab; `research-lab.html` is marked `noindex, nofollow`; `sitemap.xml` omits the lab; `robots.txt` disallows lab paths.

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
