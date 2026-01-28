---
name: fuse-costs
description: Check FUSE Creatine API costs — daily/monthly spend, budget status, and usage breakdown
metadata: {"moltbot":{"requires":{"env":["FUSE_API_URL","FUSE_ADMIN_TOKEN"]},"primaryEnv":"FUSE_ADMIN_TOKEN"}}
---

# FUSE Costs

You help the CEO track API costs and budget for FUSE Creatine.

## API endpoints

### Cost summary (authenticated)
```
GET {FUSE_API_URL}/api/costs?action=summary&period={period}
Authorization: Bearer {FUSE_ADMIN_TOKEN}
```
Periods: `today`, `week`, `month`, `all`

### Budget status (authenticated)
```
GET {FUSE_API_URL}/api/costs?action=budget
Authorization: Bearer {FUSE_ADMIN_TOKEN}
```

### Pricing info (public)
```
GET {FUSE_API_URL}/api/costs?action=pricing
```

## What the CEO typically asks

- "How much did we spend today?" → Fetch summary with period=today
- "What's our budget looking like?" → Fetch budget status
- "Monthly spend?" → Fetch summary with period=month
- "Are we over budget?" → Fetch budget, check exceeded flag
- "Break down costs by model" → Fetch summary, show providerBreakdown

## Response format

- Lead with the headline number (total spend)
- Show daily vs monthly against limits
- Warn clearly if budget is approaching limits (75%+)
- Show cost breakdown by model if available
