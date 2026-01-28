# Molt Setup for FUSE Creatine

CEO personal AI assistant via WhatsApp/Telegram, connected to FUSE infrastructure.

---

## Prerequisites

- Node.js >= 22
- Your FUSE `ADMIN_TOKEN` (same one used in Vercel env vars)
- Your `ANTHROPIC_API_KEY`
- A phone with WhatsApp (or Telegram account)

---

## Step 1: Install Molt

```bash
npm install -g moltbot
```

Or install from source:

```bash
git clone https://github.com/nicepkg/moltbot.git
cd moltbot && pnpm install && pnpm build
```

---

## Step 2: Run Onboarding

```bash
moltbot onboard --install-daemon
```

This walks you through:
1. **Auth** — Select Anthropic, enter your API key
2. **Gateway** — Choose local deployment
3. **Channel** — Scan WhatsApp QR code (or enter Telegram token)
4. **Daemon** — Install as background service (launchd on macOS, systemd on Linux)

---

## Step 3: Configure for FUSE

Copy the config template to your Molt config directory:

```bash
cp molt/moltbot.json ~/.clawdbot/moltbot.json
```

Then set your environment variables. Either export them in your shell:

```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
export FUSE_ADMIN_TOKEN="your-admin-token-here"
```

Or add them to `~/.clawdbot/moltbot.json` directly in the `env` section (replace the `${...}` placeholders).

---

## Step 4: Clone and Link Skills

Make sure the FUSE Creatine repo is cloned to `~/fuse-creatine`:

```bash
git clone https://github.com/sergiopesch/Fuse--Creatine-.git ~/fuse-creatine
```

The config already points to `~/fuse-creatine/molt/skills` as an extra skills directory. Molt will auto-detect all 6 FUSE skills:

| Skill | What it does |
|-------|-------------|
| `fuse-briefing` | Full CEO briefing (agents + costs + tasks + health) |
| `fuse-signups` | Waitlist signup data |
| `fuse-costs` | API cost tracking and budget status |
| `fuse-health` | Platform health checks |
| `fuse-agents` | Agent team management and orchestration |
| `fuse-tasks` | Task management and decision approvals |

---

## Step 5: Set Up Automated Briefings

### Morning Briefing (daily at 7 AM)

```bash
moltbot cron add \
  --name "FUSE Morning Briefing" \
  --cron "0 7 * * *" \
  --tz "Europe/London" \
  --session isolated \
  --message "Give me the full FUSE CEO briefing. Fetch /api/ceo-briefing and present the summary, any alerts, costs, agent status, and pending decisions." \
  --deliver \
  --channel whatsapp
```

### Cost Alert (every 4 hours)

```bash
moltbot cron add \
  --name "FUSE Cost Check" \
  --cron "0 */4 * * *" \
  --tz "Europe/London" \
  --session isolated \
  --message "Check FUSE API costs via /api/ceo-briefing?section=costs. Only message me if daily spend exceeds 50% of the limit or if there are any budget alerts. If everything is fine, don't send anything." \
  --deliver \
  --channel whatsapp
```

### Health Monitor (every hour)

```bash
moltbot cron add \
  --name "FUSE Health Monitor" \
  --cron "0 * * * *" \
  --session isolated \
  --message "Check FUSE platform health via /api/health and /api/ceo-briefing?section=health. Only message me if any service is degraded. If everything is healthy, don't send anything." \
  --deliver \
  --channel whatsapp
```

### Evening Summary (daily at 6 PM)

```bash
moltbot cron add \
  --name "FUSE Evening Summary" \
  --cron "0 18 * * *" \
  --tz "Europe/London" \
  --session isolated \
  --message "Give me an end-of-day FUSE summary. Fetch /api/ceo-briefing and focus on: total spend today, new signups, any unresolved decisions, and agent activity highlights." \
  --deliver \
  --channel whatsapp
```

---

## Step 6: Verify Setup

1. **Check config:**
   ```bash
   moltbot doctor
   ```

2. **Start gateway:**
   ```bash
   moltbot gateway
   ```

3. **Test from WhatsApp:** Send a message like:
   - "Give me the FUSE briefing"
   - "How many signups do we have?"
   - "What did we spend today?"
   - "Is the site up?"
   - "What are the agents doing?"

4. **List cron jobs:**
   ```bash
   moltbot cron list
   ```

5. **Force-run a cron job:**
   ```bash
   moltbot cron run "FUSE Morning Briefing" --force
   ```

---

## What You Can Say to Molt

### Quick commands

| Message | What happens |
|---------|-------------|
| "Briefing" | Full CEO briefing |
| "How many signups?" | Fetches waitlist data |
| "Spend today?" | Shows daily API costs |
| "Budget status" | Daily/monthly budget vs limits |
| "Is the site up?" | Health check on all services |
| "Agent status" | Shows all 7 teams and their state |
| "Any pending decisions?" | Lists decisions awaiting approval |
| "Approve all decisions" | Approves all pending decisions |
| "Start the marketing team" | Resumes marketing team orchestration |
| "Pause everything" | Pauses all orchestration |
| "Emergency stop" | Emergency stop all agent operations |
| "Create a task for dev team: fix the signup form" | Creates a new task |
| "Broadcast to all teams: launch is next week" | Sends broadcast message |

### Conversational

You can also have natural conversations:
- "Compare this week's costs to last week"
- "Which team has the most activity?"
- "Draft a message to the design team about the new landing page"
- "Summarize what happened while I was in meetings"

---

## Architecture

```
   You (WhatsApp/Telegram)
          |
        Molt
   (runs locally, 24/7)
     /    |    \
    /     |     \
Gmail  GitHub  FUSE APIs
Inbox  PRs     ├── /api/ceo-briefing  (aggregated briefing)
Cal    Issues   ├── /api/admin-signups (waitlist data)
               ├── /api/costs         (budget & spend)
               ├── /api/health        (system health)
               ├── /api/agents        (team management)
               └── /api/orchestrate   (orchestration)
                        |
              FUSE Agent Command Center
              (Vercel, existing infrastructure)
```

---

## Security Notes

- Molt runs on your local machine — data stays with you
- Use a **separate Anthropic API key** for Molt (not your production key)
- The `FUSE_ADMIN_TOKEN` gives full API access — keep it in environment variables, not in plaintext config
- WhatsApp pairing requires physical QR scan — no one else can access your Molt instance
- Session resets daily at 4 AM to prevent context accumulation

---

## Troubleshooting

### "Skills not loading"
```bash
moltbot doctor --fix
```
Check that `~/fuse-creatine/molt/skills` exists and contains the SKILL.md files.

### "API calls failing"
Verify your FUSE_API_URL and FUSE_ADMIN_TOKEN:
```bash
curl -H "Authorization: Bearer $FUSE_ADMIN_TOKEN" \
  https://fuse-creatine.vercel.app/api/ceo-briefing?section=summary
```

### "WhatsApp not connecting"
```bash
moltbot gateway --reset-whatsapp
```
Then scan the QR code again.

### "Cron jobs not running"
```bash
moltbot cron list
moltbot cron run "FUSE Morning Briefing" --force
```
Check that the daemon is running:
```bash
# macOS
launchctl list | grep moltbot

# Linux
systemctl status moltbot
```
