---
name: fuse-agents
description: Manage FUSE Creatine AI agent teams — check status, start/stop orchestration, change modes
metadata: {"moltbot":{"requires":{"env":["FUSE_API_URL","FUSE_ADMIN_TOKEN"]},"primaryEnv":"FUSE_ADMIN_TOKEN"}}
---

# FUSE Agents

You help the CEO manage the 7 AI agent teams at FUSE Creatine.

## Teams

| ID | Name | Agents |
|----|------|--------|
| developer | Developer Team | Architect, Coder, QA Engineer |
| design | Design Team | UX Lead, Visual Designer, Motion Designer |
| communications | Communications Team | Content Strategist, Copywriter, Social Manager |
| legal | Legal Team | Compliance Officer, Contract Analyst, IP Counsel |
| marketing | Marketing Team | Growth Lead, Brand Strategist, Analytics Expert |
| gtm | Go-to-Market Team | Launch Coordinator, Partnership Manager, Market Researcher |
| sales | Sales Team | Sales Director, Account Executive, SDR Lead, Solutions Consultant, Customer Success |

## API endpoints

### Read operations (public)
```
GET {FUSE_API_URL}/api/agents?action=status
GET {FUSE_API_URL}/api/agents?action=teams
GET {FUSE_API_URL}/api/agents?action=teams&teamId={teamId}
GET {FUSE_API_URL}/api/agents?action=analytics
GET {FUSE_API_URL}/api/agents?action=activities&limit=20
```

### Write operations (authenticated)
```
# Change orchestration mode
PUT {FUSE_API_URL}/api/agents?action=orchestration-mode
Authorization: Bearer {FUSE_ADMIN_TOKEN}
Body: {"mode": "autonomous|supervised|manual"}

# Change agent status
PUT {FUSE_API_URL}/api/agents?action=agent-status
Authorization: Bearer {FUSE_ADMIN_TOKEN}
Body: {"teamId": "...", "agentId": "...", "status": "working|idle|offline"}

# World controls
POST {FUSE_API_URL}/api/agents?action=world-pause
POST {FUSE_API_URL}/api/agents?action=world-resume
POST {FUSE_API_URL}/api/agents?action=emergency-stop
Authorization: Bearer {FUSE_ADMIN_TOKEN}
```

## What the CEO typically asks

- "What are the agents doing?" → Fetch status + activities
- "Start the marketing team" → PUT world-resume or team-resume
- "Pause everything" → POST world-pause
- "Switch to autonomous mode" → PUT orchestration-mode with mode=autonomous
- "Emergency stop" → POST emergency-stop
- "Team analytics" → Fetch analytics

## Response format

- Show team status grid: team name + status (running/paused) + active agents
- Highlight any teams currently running
- Show recent activity if available
- For commands (start/stop/mode changes): confirm action taken
