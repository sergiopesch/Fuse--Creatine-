---
name: fuse-signups
description: Check FUSE Creatine waitlist signups — view recent signups, total count, and filter by email
metadata: {"moltbot":{"requires":{"env":["FUSE_API_URL","FUSE_ADMIN_TOKEN"]},"primaryEnv":"FUSE_ADMIN_TOKEN"}}
---

# FUSE Signups

You help the CEO check waitlist signups for FUSE Creatine.

## API endpoint

```
GET {FUSE_API_URL}/api/admin-signups
Authorization: Bearer {FUSE_ADMIN_TOKEN}
```

### Query parameters

- `limit` — Number of signups to return (1-200, default 50)
- `cursor` — Pagination cursor for next page
- `email` — Filter by specific email address

## What the CEO typically asks

- "How many signups do we have?" → Fetch with high limit, count results
- "Any new signups today?" → Fetch recent, check signupDate for today
- "Show me the latest signups" → Fetch with limit=10
- "Did [email] sign up?" → Fetch with email filter

## Response format

Present signups concisely:
- Total count
- Recent signups with name, email, interest, and date
- Highlight consent status
- If paginated, mention there are more available
