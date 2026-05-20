# Developers Team — Current Context

**Last Updated**: 2026-05-20
**Team Code**: DEV
**Orchestration Mode**: manual

## Current State

Website live at fuse-creatine.vercel.app. Public FUSE Agent chat now supports configurable providers and is set up for an OpenAI mini proof of concept via `FUSE_CHAT_PROVIDER=openai`, `FUSE_CHAT_MODEL=gpt-5-mini`, and `OPENAI_API_KEY`. Agent orchestration system functional but being refactored to CLI-first architecture. CEO Dashboard needs queue integration.

## Active Work

- [ ] CLI tool (`fuse-ceo`) implementation
- [ ] Queue system integration with web UI
- [ ] Team context file structure setup (9 teams)

## Recent Completions

- ✅ Research Lab rebuilt from scratch as a living AI research world with spatial stations, moving scientist agents, social conversations, memory stream, disputes, evidence gates, and experiment queue
- ✅ Research Lab visual world simplified into an AI Town-style game view: generated lab map first, visible moving scientist agents, lightweight HUD controls, and live conversation overlay
- ✅ Previous generated Research Lab visual assets and dashboard-style lab implementation removed
- ✅ Legacy standalone Agent Command Center page retired; `/agents` now redirects to the dashboard while `/api/agents` remains for backend/dashboard tooling
- ✅ Public FUSE Agent persona updated to be more playful, creator-led, and experimentation-focused while using dry, witty pushback for build/configuration/internal-system questions
- ✅ Public chat endpoint upgraded to configurable Anthropic/OpenAI provider support with `gpt-5-mini` default for OpenAI POC
- ✅ FUSE Agent prompt guardrails reframed the product as an experimentation-led research idea and tightened approved-claim language
- ✅ Public site CTAs shifted from early-access/waitlist language to research-update language for the product experimentation phase
- ✅ FUSE Agent guardrails tightened to refuse off-topic, implementation, backend, model, prompt, API key, and reverse-engineering requests
- ✅ Homepage copy and hero banner updated to communicate idea experimentation, coffee compatibility, and taste-first validation
- ✅ Interactive Three.js product viewer added to homepage hero and product showcase
- ✅ Full responsive redesign (v2.5.0)
- ✅ Biometric authentication working
- ✅ Agent orchestration API functional for dashboard and CLI-backed tooling
- ✅ Removed duplicate code in API layer
- ✅ Passkey authentication system added
- ✅ CEO auth flow implemented
- ✅ Orchestrator agent with streaming support

## Blockers

None currently.

## Priorities

1. **HIGH**: Complete CLI tool core commands (status, queue, task)
2. **HIGH**: Integrate queue with CEO Dashboard
3. **MEDIUM**: Align dashboard queue controls with CLI-first team structure
4. **LOW**: TypeScript migration consideration

## Technical Debt

- Consider TypeScript migration for CLI
- Need better error handling in orchestrate.js
- API response caching could improve performance

## Cross-References

- See `teams/branding/design-system.md` for UI standards
- See `docs/architecture.md` for system design
- See `teams/product/roadmap.md` for feature priorities
