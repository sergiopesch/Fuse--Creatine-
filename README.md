# FUSE Creatine - Coffee-Optimised Creatine + AI Agent Command Center

Britain's first coffee-optimised creatine with Instant Fusion Technology, powered by an AI-driven corporate agent orchestration system.

> **Note:** FUSE Creatine is currently a concept/idea stage product. Statistics shown on the site (e.g. potential cities) represent aspirational targets, not real metrics. No pricing has been finalised.

## Overview

FUSE Creatine is a dual-purpose platform:
1. **Product Website** - Marketing site for FUSE Creatine supplement concept
2. **AI Agent Command Center** - Corporate simulation with orchestratable AI agent teams

## Architecture

### Tech Stack

| Technology | Purpose |
|------------|---------|
| **Frontend** | Vanilla JavaScript, CSS3, HTML5, GSAP, ScrollTrigger, Lenis |
| **Backend** | Vercel Serverless Functions (Node.js 18+) |
| **Storage** | Vercel Blob (credentials, signups), Upstash Redis (rate limiting) |
| **AI Provider** | Anthropic Claude API (primary), OpenAI/Gemini (optional) |
| **Authentication** | WebAuthn (biometric passkeys), Admin token-based |

### Project Structure

```
fuse-creatine/
├── index.html              # Marketing landing page
├── dashboard.html          # Company Dashboard (biometric-protected)
├── agents.html             # Agent Command Center
├── admin.html              # Admin analytics portal
├── privacy.html            # Privacy policy
├── terms.html              # Terms and conditions
├── api/
│   ├── _lib/
│   │   ├── security.js         # Authentication, rate limiting, validation
│   │   ├── biometric-utils.js  # Shared biometric utilities (NEW)
│   │   ├── webauthn.js         # WebAuthn helpers
│   │   ├── cost-tracker.js     # API usage and cost tracking
│   │   ├── circuit-breaker.js  # Resilience patterns
│   │   ├── world-controller.js # Agent state management
│   │   └── crypto.js           # Encryption utilities
│   ├── agents.js               # Agent management API
│   ├── orchestrate.js          # Team orchestration API (Claude)
│   ├── chat.js                 # FUSE Agent chat API
│   ├── signup.js               # Waitlist signup API
│   ├── health.js               # Health check endpoint
│   ├── costs.js                # Cost tracking API
│   ├── admin-signups.js        # Protected admin API
│   ├── biometric-authenticate.js # WebAuthn verification
│   └── biometric-register.js     # WebAuthn registration
├── js/
│   ├── main.js             # Marketing page animations
│   ├── agents.js           # Agent Command Center UI
│   ├── dashboard.js        # Company Dashboard UI
│   ├── admin.js            # Admin portal UI
│   ├── chat.js             # Chat widget
│   ├── biometric-auth.js   # WebAuthn client
│   └── consent-manager.js  # Cookie/consent management
├── css/
│   ├── style.css           # Marketing page styles
│   ├── agents.css          # Agent Command Center styles
│   ├── dashboard.css       # Dashboard styles
│   ├── admin.css           # Admin styles
│   ├── biometric-gate.css  # Biometric auth UI styles
│   ├── consent.css         # Consent UI styles
│   └── legal.css           # Legal pages styles
├── research/               # Product research & validation
│   ├── science/            # Creatine science research
│   ├── content/            # Content strategy
│   ├── testing/            # Lab validation
│   └── validation/         # Market validation
├── docs/                   # Documentation
│   └── DASHBOARD_AUTH_DEBUG_REPORT.md  # Biometric auth debug guide
├── molt/                   # Molt bot integration (CEO assistant skills)
├── scripts/                # Utility scripts
│   ├── test-signup-integration.js  # Integration tests
│   └── test-orchestration.sh       # Orchestration tests
└── assets/
    └── favicon.svg         # Brand favicon
```

## AI Agent Command Center

### Corporate Structure

The platform simulates a corporate workforce with 7 specialized AI agent teams:

| Team | Badge | Agents | Focus |
|------|-------|--------|-------|
| **Developer** | DEV | Architect, Coder, QA Engineer | Platform development |
| **Design** | DSN | UX Lead, Visual Designer, Motion Designer | User experience |
| **Communications** | COM | Content Strategist, Copywriter, Social Manager | Brand voice |
| **Legal** | LGL | Compliance Officer, Contract Analyst, IP Counsel | Compliance |
| **Marketing** | MKT | Growth Lead, Brand Strategist, Analytics Expert | Growth |
| **Go-to-Market** | GTM | Launch Coordinator, Partnership Manager, Market Researcher | Launch |
| **Sales** | SLS | Sales Director, Account Executive, SDR Lead, Solutions Consultant, Customer Success | Revenue |

### Orchestration Modes

Teams operate in one of three modes:

| Mode | Description | Default |
|------|-------------|---------|
| **Manual** | All agent actions require explicit approval | YES |
| **Supervised** | Major decisions require approval | No |
| **Autonomous** | Agents operate independently | No |

**Important**: All teams default to **Manual/Paused** state. You must explicitly start orchestration.

### Starting Team Orchestration

1. Navigate to `/agents` (Agent Command Center)
2. Select a team from the sidebar
3. Click "Start Orchestration" to begin
4. Monitor activities in the Live Feed
5. Approve/reject decisions in the Decision Queue

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents` | GET | Get agent status, teams, tasks, decisions |
| `/api/agents` | POST | Create tasks, decisions, broadcasts |
| `/api/agents` | PUT | Update agent status, orchestration mode |
| `/api/orchestrate` | POST | Execute team orchestration (Claude API) |
| `/api/chat` | POST | FUSE Agent chat interactions |
| `/api/health` | GET | System health and API status |
| `/api/costs` | GET | Usage and cost metrics |
| `/api/biometric-authenticate` | POST | WebAuthn authentication |
| `/api/biometric-register` | POST | WebAuthn registration |

### Orchestration API

Start team orchestration:

```bash
curl -X POST /api/orchestrate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "developer",
    "action": "start",
    "task": "Review current sprint priorities"
  }'
```

Stop orchestration:

```bash
curl -X POST /api/orchestrate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{ "teamId": "developer", "action": "stop" }'
```

Get orchestration status:

```bash
curl /api/orchestrate?teamId=developer
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for agent orchestration |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob storage token |
| `ADMIN_TOKEN` | Yes | Admin authentication token (32+ chars) |
| `ENCRYPTION_KEY` | Yes | PII encryption key (32+ chars) |
| `AGENTS_API_TOKEN` | Optional | Alternative token for agent API access |
| `OPENAI_API_KEY` | Optional | OpenAI API key (alternative provider) |
| `GEMINI_API_KEY` | Optional | Google Gemini API key (alternative provider) |
| `WEBAUTHN_RP_ID` | Optional | Override WebAuthn RP ID (comma-separated) |
| `WEBAUTHN_ORIGINS` | Optional | Override allowed WebAuthn origins (comma-separated) |
| `UPSTASH_REDIS_REST_URL` | Optional | Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Redis token for authentication |
| `DAILY_BUDGET_LIMIT` | Optional | Daily API cost limit (default: $50) |
| `MONTHLY_BUDGET_LIMIT` | Optional | Monthly API cost limit (default: $500) |

## Getting Started

### Prerequisites

- Node.js 18+
- Vercel CLI (`npm i -g vercel`)
- Anthropic API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/fuse-creatine.git
   cd fuse-creatine
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. Start development server:
   ```bash
   vercel dev
   ```

5. Open `http://localhost:3000`

### Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Configure environment variables in Vercel Dashboard > Settings > Environment Variables.

## Security Features

### Authentication Layers

- **WebAuthn Biometric**: Face ID/Touch ID/Windows Hello passkeys for dashboard access
- **Admin Token**: Bearer token authentication for API access
- **Session Tokens**: HMAC-signed tokens with 30-minute expiry

### Security Controls

| Feature | Description |
|---------|-------------|
| **Rate Limiting** | Per-IP limits via Redis (optional in-memory fallback) |
| **Input Validation** | Schema-based with sanitization |
| **CORS** | Explicit origin whitelist |
| **Encryption** | AES-256-GCM for PII |
| **Prompt Injection Detection** | 100+ pattern checks in chat API |
| **Circuit Breaker** | API resilience with auto-recovery |
| **Audit Logging** | All authenticated actions logged |
| **Device Fingerprinting** | Multi-device support with owner-lock |
| **Lockout Protection** | Progressive lockout after failed attempts |

### Key Security Files

| File | Purpose |
|------|---------|
| `api/_lib/security.js` | Core security middleware |
| `api/_lib/biometric-utils.js` | Shared biometric utilities |
| `api/_lib/webauthn.js` | WebAuthn helpers |
| `api/biometric-authenticate.js` | Authentication endpoint |
| `api/biometric-register.js` | Registration endpoint |

## Cost Management

The platform tracks API usage and costs:

- Real-time token counting
- Per-request cost calculation
- Daily/monthly budget alerts
- Cost breakdown by provider and endpoint

View costs at `/api/costs` or in the Admin portal.

## Product Website Features

### Marketing Pages

- Smooth scrolling with Lenis
- GSAP animations with ScrollTrigger
- Premium product imagery with animated CSS integration
- Magnetic button effects
- Custom cursor with blend mode
- Dose configurator
- Waitlist signup modal

### Branding

- **Logo:** "FUSE CREATINE" — "FUSE" in brand red (#ff3b30), "CREATINE" in white
- **Hero headline:** "FUSE CREATINE" — same colour treatment as logo
- **Messaging:** Science-grounded, evidence-based claims backed by peer-reviewed research
- **No pricing displayed** — product is at idea/concept stage

### FUSE Agent Chat

AI-powered customer service assistant:

- Powered by Claude 3.5 Haiku
- British personality with evidence-based responses
- Product knowledge for FUSE creatine
- Quick action buttons
- Conversation history
- Security: prompt injection detection, response validation

## Testing

### Unit Tests

```bash
npm test
```

### Integration Test

```bash
BASE_URL="https://your-deployment-url" \
ADMIN_TOKEN="your-admin-token" \
node scripts/test-signup-integration.js
```

### Orchestration Test

```bash
# Test all agent teams
./scripts/test-orchestration.sh
```

### Test Coverage

```bash
npm run test:coverage
```

Current coverage thresholds: 50% (branches, functions, lines, statements)

## Browser Support

- Chrome 90+ (desktop & mobile)
- Firefox 88+ (desktop & mobile)
- Safari 14+ (desktop & iOS)
- Edge 90+

**Responsive:** Optimized for viewports from 393px (iPhone 14 Pro) to 2560px+ ultrawide. All pages tested at iPhone SE (375px), iPhone 14 Pro (393px), iPad (768px), and desktop (1200px+).

**Note**: WebAuthn requires a platform authenticator (Face ID, Touch ID, Windows Hello, or fingerprint sensor).

## Architecture Roadmap

### Planned: AWS Migration

Potential future migration from in-memory stores to persistent AWS storage.

| Current | Planned | Status |
|---------|---------|--------|
| Vercel Blob (signups) | DynamoDB | Planned |
| In-memory (agents) | DynamoDB | Planned |
| In-memory (costs) | DynamoDB | Planned |
| In-memory (audit) | DynamoDB | Planned |
| Upstash Redis | Keep / ElastiCache | Planned |

### Consent Management

Client-side cookie consent and preference system.

| Feature | Status |
|---------|--------|
| Cookie consent banner | Implemented |
| Preference center | Implemented |
| Consent audit trail | Planned |
| Data export (GDPR) | Planned |
| Data deletion (GDPR) | Planned |

### Documentation

| Document | Description |
|----------|-------------|
| [Auth Debug Guide](./docs/DASHBOARD_AUTH_DEBUG_REPORT.md) | Biometric auth debug reference |

---

## Recent Updates

### Version 2.5.0
- **Full responsive redesign** targeting iPhone 14 Pro (393px) and all small mobile devices
  - Added `@media (max-width: 420px)` breakpoints across all 8 CSS files
  - Fixed hero orbs overflow (520-680px orbs scaled to 210-340px on mobile)
  - Fixed admin table `min-width: 980px` → `600px` with horizontal scroll container
  - Made dashboard header, nav tabs, and control bar fully mobile-adaptive
  - Added responsive breakpoints to legal.css (previously had none)
  - Chat widget goes full-width on small screens
  - All dashboards collapse to single-column grids on mobile
  - Modals become bottom sheets / full-width on small screens
- **Removed duplicate code** in API layer
  - Removed duplicate `getCorsOrigin()`/`setSecurityHeaders()` from `chat.js` and `health.js` (now imported from `_lib/security.js`)
  - Removed duplicate imports from `magic-link.js`
  - `health.js` reduced from 148 to 94 lines
- **Cleaned up outdated documentation**
  - Removed 8 "Planning Phase" architecture docs that were never implemented
  - Kept active reference doc (DASHBOARD_AUTH_DEBUG_REPORT.md)
  - Updated README to reflect current state

### Version 2.4.0
- Rebranded from "FUSE UK" to "FUSE Creatine" across all touchpoints
- Updated hero headline from "POUR. FUSE." to "FUSE CREATINE" (red + white styling)
- Replaced specific member/athlete counts with science-backed stats
- Removed pricing section (product is at idea stage)
- Updated all CTAs from pricing-focused to "Get Early Access"

### Version 2.3.0
- Cookie consent banner and preference center (client-side)
- Consent UI with accessible, WCAG 2.1 AA compliant design

### Version 2.2.0
- Refactored biometric authentication to use shared utilities module
- Reduced code duplication between authenticate and register endpoints

### Version 2.1.0
- Added multi-device support for biometric authentication
- Implemented device linking feature
- Added CEO Dashboard (since replaced by `fuse-ceo` CLI)

## License

This project is proprietary. All rights reserved.

---

**Engineered in Britain** | FUSE Creatine
