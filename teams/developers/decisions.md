# Developers Team — Technical Decisions Log

## Decision Format

Each decision follows: **Date | Decision | Rationale | Impact**

---

## 2026-05-22 | Research Lab Generative Agent Runtime

**Decision**: Port StanfordHCI `genagents` concepts into the existing FUSE Research Lab World using the current Node/Vercel stack.

**Rationale**: Sergio wants the lab to become a real daily discovery system rather than a mock view. The Stanford repo's useful production concepts are scratch identity, memory stream, retrieval, reflection, and interaction; a full Python/FastAPI/Godot rewrite would not match the current lightweight deployment path.

**Impact**: `api/_lib/research-lab-state.js` now gives each lab scientist a scratch identity, memory retrieval scored by recency/importance/relevance, structured action/observation/reflection memories, hierarchical experiment plans, lab object affordances, and simulated batch telemetry. `/research-lab` exposes a visible cognition area with selected-agent memory retrieval and plans. `/api/research-lab-daily` and `vercel.json` add a protected daily cron that advances three autonomous discovery ticks and stores a daily digest. New focused Jest coverage validates initialization, batch telemetry, retrieval, and daily discovery.

---

## 2026-05-22 | Research Lab OpenAI Daily Brain

**Decision**: Add an optional OpenAI Responses API synthesis pass to the Research Lab daily cron while keeping browser ticks deterministic.

**Rationale**: The lab needs to create useful daily research value without runaway cost. A model call on every browser auto-tick would be wasteful, but one daily structured synthesis can turn simulated memories, batches, hypotheses, and disputes into an actionable R&D brief.

**Impact**: `api/_lib/research-lab-brain.js` calls OpenAI when `OPENAI_API_KEY` is configured and `FUSE_LAB_AI_ENABLED` is not `false`, using `FUSE_LAB_AI_MODEL` or `gpt-5-mini` by default. The daily brief includes headline, top insight, per-agent findings, next physical test, ranked actions, risk, and Sergio decision needed, then writes that output back as an internal reflection memory. The lab UI now surfaces the daily AI synthesis panel. If OpenAI fails or is disabled, the daily run writes a deterministic fallback so discovery never stops.

---

## 2026-05-22 | Research Lab Weekly GPT-5.5 Review

**Decision**: Add a weekly GPT-5.5 Development Readiness Review alongside the daily mini-model synthesis.

**Rationale**: The daily model call should stay cheap and operational, while the weekly call should answer Sergio's strategic question: whether FUSE should continue, pause, pivot, or kill the current development direction before spending on real prototypes, supplier work, IP review, or manufacturing.

**Impact**: `/api/research-lab-weekly` exposes a protected weekly cron endpoint scheduled for Mondays at 08:00 UTC. `api/_lib/research-lab-brain.js` now defaults the weekly model to `gpt-5.5` with high reasoning and returns a strict readiness schema: recommendation, confidence, readiness score, evidence for/against, required real-world tests, legal/manufacturing risks, next spend decision, and Sergio decision needed. The lab UI shows the weekly review panel, and the weekly output is saved back into the memory stream as an internal development review.

---

## 2026-05-22 | Research Lab Admin Backend Door

**Decision**: Add a token-protected admin control plane for Research Lab cycles.

**Rationale**: Sergio needs operational control over AI spend and cadence without redeploying environment variables. Scheduled jobs should be pausable, and manual lab cycles should be available for ad hoc reviews.

**Impact**: `/api/research-lab-admin` exposes signed-session or `ADMIN_TOKEN`-protected controls for reading lab status, updating daily/weekly/model toggles, running one world tick, running daily discovery, and running the weekly GPT-5.5 review manually. `admin.html`, `js/admin.js`, and `css/admin.css` add an AI Lab Control tab with automation switches, model fields, manual run buttons, and status cards. `api/_lib/research-lab-state.js` persists lab controls in the research lab state and scheduled cron handlers respect disabled daily/weekly flags while manual admin runs force execution.

---

## 2026-05-22 | Admin Username Password Login

**Decision**: Replace the admin page's raw token entry with username/password login using `ADMIN_USERNAME=sergiopesch`.

**Rationale**: The admin token should stay as a backend/API fallback, not be the primary credential pasted into the browser. A username/password exchange lets the site issue a short-lived signed session while keeping the password hash and session secret in Vercel environment variables.

**Impact**: `/api/admin-login` verifies `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`, then returns an eight-hour signed admin session. `api/_lib/admin-auth.js` centralizes scrypt password verification, session signing, and admin request authentication. `admin.html` and `js/admin.js` now use username/password login. `/api/admin-signups` and `/api/research-lab-admin` accept signed sessions while retaining `ADMIN_TOKEN` as a direct API fallback. `scripts/generate-admin-password-hash.js` generates the Vercel `ADMIN_PASSWORD_HASH` value.

---

## 2026-05-22 | Admin Passkey Login

**Decision**: Replace browser password login with WebAuthn passkey login for `sergiopesch`.

**Rationale**: Passkeys give Sergio a smoother iPhone Face ID / QR-code-capable login while keeping private biometric verification inside the device ecosystem. The site only receives a signed WebAuthn assertion and then issues the same short-lived admin session used by protected admin APIs.

**Impact**: `/api/admin-passkey` now handles admin passkey status, setup challenge, setup verification, sign-in challenge, and sign-in verification. `api/_lib/admin-passkey-store.js` stores admin passkey credentials and one-time WebAuthn challenges using Upstash Redis with local memory fallback. `admin.html`, `js/admin.js`, and `css/admin.css` make the admin page passkey-first and keep the admin password only for setup/recovery. `/api/admin-login` no longer issues password sessions. `ADMIN_TOKEN` remains as a direct API fallback for scripts and emergencies.

---

## 2026-05-20 | Product Showcase Visual Polish

**Decision**: Rework the homepage product section into a stronger product-stage view using the high-fidelity product cutout, tighter headline composition, and development-focus spec tiles.

**Rationale**: The previous product view leaned on the Three.js render in a large showcase context, where the material appeared too blank and visually weak. The dedicated rendered asset better communicates the physical product texture while preserving a premium dark FUSE layout.

**Impact**: `index.html` now uses the static product cutout for both hero and product showcase, removes the old interactive product viewer from the page, and adds compact product-focus metadata. `css/style.css` adds the new product-stage composition, responsive title treatment, and spec tile styling. `js/product-viewer.js` was removed because the weaker generated product render is no longer used.

---

## 2026-05-20 | Research Lab Generated World Art

**Decision**: Replace the abstract grid lab stage with Sergio's preferred generated premium lab-world map, then simplify the surface into an AI Town-style game view.

**Rationale**: The grid-style world still felt like the old implementation. Sergio wants the new Research Lab World to match the generated control-room/lab image that made the concept feel alive.

**Impact**: `/research-lab` now uses `assets/lab/research-lab-world-map-clean.png` as the central stage, with moving lab-coat scientist sprites and live speech bubbles layered over the image. The map art has been cleaned so baked-in static scientists are removed and only live sprites represent people in the world. Station cards, mission sidebars, hypothesis walls, dense control-room panels, and initials-in-circle markers were removed from the primary view so the lab reads as a game world first. Station coordinates in `api/_lib/research-lab-state.js` were realigned to the generated map zones, and agent motion now uses per-agent patrol cadence, animation speed, phase delay, and facing direction inspired by AI Town's independent character simulation model.

**UX follow-up**: The page now renders a local bootstrap world before the research-lab API resolves, preloads the lab map image, removes long in-world speech banners that overlapped agents and station labels, and replaces them with a compact interaction link while the full dialogue remains in the live conversation panel.

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
