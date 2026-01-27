# Molt Technology Evaluation for FUSE Creatine

**Date:** 2026-01-27
**Prepared for:** CEO
**Technology:** Molt (molt.bot) - Open-source personal AI assistant
**Verdict:** Partial fit. Strong for CEO daily ops; does NOT replace our Agent Command Center.

---

## What Is Molt?

Molt (formerly Clawdbot) is an **open-source personal AI assistant** that runs locally on your machine and connects through messaging platforms. Created by Peter Steinberger.

### Core Capabilities

| Capability | Details |
|------------|---------|
| **Messaging** | WhatsApp, Telegram, Discord, Slack, Signal, iMessage |
| **AI Models** | Claude, GPT, local models (user chooses) |
| **System Access** | File read/write, shell commands, browser automation |
| **Integrations** | 50+ services: Gmail, GitHub, Spotify, Obsidian, Twitter |
| **Memory** | Persistent context across conversations |
| **Scheduling** | Cron jobs, webhooks, Gmail Pub/Sub hooks |
| **Platforms** | macOS, Windows, Linux, iOS, Android |
| **Privacy** | Data stays on local machine, open-source |
| **Cost** | Free (you pay for your own LLM API keys) |

### Architecture

- **Gateway**: Central process managing channel connections + WebSocket control plane
- **Agents**: AI agents bridged via RPC with tool streaming
- **Sessions**: DMs collapse into shared sessions, group chats supported
- **Skills**: Extensible via community-built or custom skills
- **Sandboxing**: Session isolation for group/channel contexts
- **Media**: Images, audio, documents, voice note transcription
- **UI**: WebChat, macOS menu bar app, iOS/Android apps, browser dashboard

### Setup

```bash
moltbot onboard --install-daemon
```

Walks through auth selection, gateway config, channel integration, and daemon installation (runs 24/7 in background).

---

## How FUSE Creatine Currently Operates

| Area | Current Implementation |
|------|----------------------|
| **AI Orchestration** | Custom Agent Command Center with 7 specialized teams (~27 agents) |
| **AI Model** | Anthropic Claude API (Claude 3.5 Haiku) |
| **Agent Architecture** | Observe-Act-Evaluate loops, tool-use, multi-team orchestration |
| **Customer Chat** | FUSE Agent Chat (Claude-powered, embedded in website) |
| **Auth** | WebAuthn (biometric), Magic Link, Admin tokens |
| **Infrastructure** | Vercel serverless, Upstash Redis, Vercel Blob, planned DynamoDB |
| **Cost Control** | Built-in budget tracking ($50/day, $500/month limits) |
| **Security** | AES-256-GCM encryption, prompt injection detection, rate limiting |

---

## Evaluation: Where Molt Fits

### YES - Strong Fit

#### 1. CEO Personal Assistant via WhatsApp/Telegram
Molt shines as a **personal command interface**. As CEO, you could message Molt on WhatsApp to:
- "Summarize today's signups"
- "Draft an investor email about our Q1 progress"
- "Check if the website is up"
- "What were our API costs this week?"

This gives you **instant access to AI from your phone** without opening the dashboard.

#### 2. Email & Calendar Automation
- Gmail Pub/Sub hooks to auto-triage inbox
- Schedule and manage meetings
- Draft responses to investor/partner emails
- Morning briefing summaries delivered to your messaging app

#### 3. GitHub & Development Workflow
- Monitor PRs and issues via messaging
- Get notified of deployment failures
- Quick code reviews or questions about the codebase
- "What changed in the last 3 commits?" from your phone

#### 4. Content & Social Media Drafting
- Draft social media posts for the marketing calendar
- Research competitor activity
- Generate content briefs from your messaging app
- Quick brainstorming sessions on-the-go

#### 5. Always-On Monitoring
- Cron jobs to check website health, API costs, signup rates
- Proactive alerts: "Daily signups dropped 40% vs last week"
- Scheduled reports delivered to your preferred messaging platform

### MAYBE - Needs Customization

#### 6. Customer Support Triage
Molt could monitor incoming support emails and route them, but our existing FUSE Agent Chat is already purpose-built for customer-facing interactions with product knowledge, prompt injection protection, and rate limiting. Molt would need significant customization to match this.

#### 7. Team Communication Bridge
Molt could relay information between platforms (e.g., Slack updates to WhatsApp), but this overlaps with what our Agent Command Center already does with inter-team messaging.

### NO - Does Not Replace

#### 8. Agent Command Center
Molt is a **personal assistant**, not a **corporate orchestration platform**. It cannot replace our:
- 7 specialized AI teams with domain-specific prompts
- Multi-team orchestration with approval workflows
- World Controller with emergency stops
- Cost tracking and budget enforcement
- Audit logging for compliance
- Role-based access control (Admin, Biometric, Public)

#### 9. Website AI Chat
Our FUSE Agent Chat has product-specific knowledge, 100+ prompt injection patterns, and strict guardrails. Molt is not designed for public-facing customer interactions.

#### 10. Authentication & Security Infrastructure
Molt has no equivalent to our WebAuthn, magic link, or admin token systems.

---

## Recommended Implementation Strategy

### Phase 1: CEO Personal Interface (Low effort, high value)
1. Install Molt locally on your machine
2. Connect WhatsApp or Telegram as primary channel
3. Configure with Anthropic API key (same one FUSE uses)
4. Set up basic skills:
   - Morning briefing (daily cron)
   - Cost monitoring (check API spend)
   - Signup summary (query Vercel Blob)

### Phase 2: Development Workflow (Medium effort)
1. Connect GitHub integration
2. Set up PR/issue monitoring
3. Enable code-related queries via messaging

### Phase 3: Custom Skills for FUSE (Higher effort)
1. Build custom Molt skill that queries our `/api/agents` endpoints
2. Build skill that pulls signup analytics from `/api/admin-signups`
3. Build skill that monitors `/api/health` and alerts on issues
4. Enable cost tracking queries via `/api/costs`

---

## Architecture Diagram: How Molt Would Fit

```
                    CEO (WhatsApp/Telegram)
                           |
                         Molt
                    (Local Machine)
                    /      |       \
                   /       |        \
           Gmail     GitHub     FUSE APIs
           Inbox     PRs/       /api/agents
           Calendar  Issues     /api/costs
                               /api/health
                               /api/admin-signups
                                    |
                          FUSE Agent Command Center
                          (Existing Infrastructure)
                          7 Teams / 27 Agents
```

Molt acts as a **personal gateway layer** on top of existing FUSE infrastructure. It does NOT replace any existing systems.

---

## Cost Impact

| Item | Cost |
|------|------|
| Molt software | Free (open-source) |
| LLM API usage | Additional ~$5-20/month for personal assistant queries |
| Setup time | Initial setup + custom skills development |
| Infrastructure | Runs on CEO's local machine (no server costs) |

**Total incremental cost: ~$5-20/month in API fees**

---

## Risks & Considerations

1. **Local machine dependency**: Molt runs on your machine. If your laptop is off, Molt is off. Mitigated by daemon mode + always-on desktop.
2. **API key management**: Molt would have direct access to your Anthropic API key. Keep separate keys for personal vs production use.
3. **Data separation**: Molt's persistent memory stores conversation history locally. Ensure sensitive business data handling aligns with your data policy.
4. **Maintenance**: As an open-source project, updates and bug fixes depend on community/maintainer. Monitor for breaking changes.
5. **Node.js requirement**: Needs Node.js >= 22 installed.

---

## Final Recommendation

**Use Molt as your personal CEO command interface, not as a replacement for FUSE infrastructure.**

Molt fills a gap we currently have: **there is no way for the CEO to quickly interact with company data from a phone via messaging.** The Agent Command Center requires a browser, authentication, and dashboard navigation. Molt would let you check signups, costs, agent status, and draft communications from WhatsApp in seconds.

The two systems are complementary:
- **Molt** = Personal AI assistant for the CEO (messaging-first, mobile-friendly)
- **FUSE Agent Command Center** = Corporate AI orchestration (web-based, multi-team, audited)

Together, they give you both strategic oversight (Command Center) and tactical speed (Molt on your phone).
