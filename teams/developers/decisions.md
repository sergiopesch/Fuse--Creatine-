# Developers Team — Technical Decisions Log

## Decision Format

Each decision follows: **Date | Decision | Rationale | Impact**

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
