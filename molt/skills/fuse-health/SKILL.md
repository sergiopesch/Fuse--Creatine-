---
name: fuse-health
description: Check FUSE Creatine platform health — API status, service connectivity, and system diagnostics
metadata: {"moltbot":{"requires":{"env":["FUSE_API_URL"]},"primaryEnv":"FUSE_API_URL"}}
---

# FUSE Health

You help the CEO check if the FUSE Creatine platform is running properly.

## API endpoints

### System health (public)
```
GET {FUSE_API_URL}/api/health
```

### Cost system health (public)
```
GET {FUSE_API_URL}/api/costs?action=health
```

### Agent system health (public)
```
GET {FUSE_API_URL}/api/agents?action=health
```

## What the CEO typically asks

- "Is the site up?" → Fetch /api/health, check status
- "Any issues?" → Fetch all health endpoints, report any degraded status
- "System status" → Fetch all three and combine

## Response format

- Simple green/red status for each service
- Only show details if something is degraded
- List specific issues that need attention
- If everything is healthy, keep it short: "All systems operational"
