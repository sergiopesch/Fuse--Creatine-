# Agent Architecture Review: FUSE Creatine Agent Ecosystem

**Date:** 2026-01-28
**Benchmark:** [Agent-Native Architecture Guide](https://every.to/guides/agent-native)
**Scope:** Full orchestration stack — agent-loop, agent-tools, agent-state, context-builder, world-controller, orchestrate.js

---

## Executive Summary

The FUSE agent ecosystem is a well-structured multi-team orchestration platform with 7 corporate teams (22+ agents) coordinated via Claude API. The architecture already implements several agent-native best practices — explicit completion signals, tool-based action loops, and atomic tool design. However, the review against the agent-native guide surfaces **11 significant gaps** that limit the system's composability, resilience, and ability to improve over time.

The most critical findings:

1. **Dual orchestration paths** (`execute` vs `execute-agentic`) create architectural inconsistency — one is single-shot, the other is agentic. Only the agentic path follows best practices.
2. **Triple state desynchronization** — `orchestrate.js` maintains its own `orchestrationState` object despite `agent-state.js` being designated as the single source of truth.
3. **No persistent memory** — all state is in-memory and lost on every Vercel cold start, meaning agents cannot improve over time.
4. **Tool parity gap** — agents cannot do everything the UI/API can do (no delete, no world-state changes, no model configuration).
5. **Circuit breaker exists but is unused** — `circuit-breaker.js` is never imported by the agent loop or orchestration engine.

---

## Detailed Analysis by Agent-Native Principle

### 1. PARITY — "Can the agent accomplish every UI action?"

**Article guidance:** Pick any UI action. Can the agent accomplish it through tools? Orphan UI actions (things users can do that agents cannot) are an anti-pattern.

**Current state: PARTIAL (6/10)**

The API surface (`agents.js`) exposes ~30 actions. The agent toolset (`agent-tools.js`) exposes only 11 tools. The following actions are **orphaned** — available to the UI/API but not to agents:

| UI/API Action | Agent Tool Equivalent | Gap |
|---|---|---|
| Delete task | `DELETE ?action=task` | No `delete_task` tool |
| Delete decision | `DELETE ?action=decision` | No `delete_decision` tool |
| Change world state | `PUT ?action=world-state` | No `set_world_state` tool |
| Emergency stop | `POST ?action=emergency-stop` | No tool |
| Change agent model | `PUT ?action=agent-model` | No tool |
| Update credit limits | `PUT ?action=credit-limits` | No tool |
| Broadcast to all teams | `POST ?action=broadcast` | No `broadcast` tool |
| Trigger action for team | `POST ?action=trigger-action` | No tool |
| Resolve decision | `PUT ?action=decision` | No `resolve_decision` tool |

**Impact:** Agents cannot self-organize beyond creating tasks and sending messages. They cannot clean up after themselves (delete completed tasks), escalate emergencies, or dynamically adjust their own operating parameters.

**Recommendation:** Add tools for `delete_task`, `resolve_decision`, and `broadcast_message` at minimum. Dangerous operations (emergency stop, model changes) should remain owner-only.

---

### 2. GRANULARITY — "Tools should be atomic primitives"

**Article guidance:** One conceptual action per tool. Judgment stays in prompts, not tool logic. Tools should not bundle decision-making.

**Current state: STRONG (8/10)**

The tool design in `agent-tools.js` is well-decomposed:

- `get_system_state` — observe (with filterable `include` sections)
- `create_task` — single atomic mutation
- `update_task_status` — single atomic mutation
- `send_message` — single atomic communication
- `signal_completion` — explicit lifecycle control

No tools bundle multiple decisions or contain conditional business logic. The `executeAgentTool` function is a clean dispatcher. Tool handlers validate inputs and mutate state minimally.

**One concern:** The `get_system_state` tool returns a lot of data in one call. The article recommends granular observation tools. The current design already has both `get_system_state` (broad) and `get_tasks`/`get_decisions`/`get_team_info` (narrow), which is a good graduated pattern.

---

### 3. COMPOSABILITY — "New features via prompts alone"

**Article guidance:** Atomic tools should enable new features through prompt-writing alone, without shipping code.

**Current state: MODERATE (5/10)**

The agentic loop (`execute-agentic`) does support prompt-driven behavior — the `task` parameter is free-form natural language, and the agent can compose tools in any order. This is good.

**However**, the non-agentic `execute` path is a single-shot Claude call that returns text, which is then regex-parsed (`parseAgentResponses`). This path has zero composability — it cannot use tools, iterate, or signal completion. It exists alongside the agentic path, creating confusion about which path teams should use.

**The system prompt duplication is a composability issue.** Team prompts are defined in three places:

| Location | Purpose | Used By |
|---|---|---|
| `orchestrate.js:60-123` | Full `TEAM_PROMPTS` with `systemPrompt` | `executeOrchestration()` (non-agentic) |
| `agent-state.js:109-138` | Simplified `TEAM_PROMPTS` (name + agents only) | `buildTeamContext()` (agentic) |
| `agent-state.js:23-103` | `DEFAULT_TEAMS` with roles/badges/colors | State initialization |

When someone wants to "add a feature via prompt," they need to edit prompts in at least two places. This violates the composability principle.

**Recommendation:** Consolidate to a single `TEAM_PROMPTS` definition. Deprecate the non-agentic `execute` path or merge it into the agentic path with `maxIterations: 1` for backward compatibility.

---

### 4. EXPLICIT COMPLETION SIGNALS

**Article guidance:** Don't rely on heuristics. Tools must explicitly signal completion separate from success/failure. Use `.complete()` to stop the loop, not pattern matching.

**Current state: STRONG (9/10)**

This is one of the architecture's strongest areas. The `signal_completion` tool is well-implemented:

```javascript
// agent-loop.js:187-191
if (toolUse.name === 'signal_completion') {
    completionSignaled = true;
    result.completed = true;
    result.completionSummary = toolResult.data?.summary || 'Completed';
}
```

The loop correctly distinguishes between:
- **Explicit completion** via `signal_completion` tool → `result.completed = true`
- **Natural completion** when agent responds without tool calls → also marks `completed = true`
- **Max iterations** → `result.completed = false` with explanatory message

**Minor gap:** The article recommends distinguishing `.success()`, `.error()`, and `.complete()` as three separate signals. Currently, all tool results use `{ success: boolean }`, and only `signal_completion` stops the loop. An agent cannot explicitly signal "this failed, stop trying" versus "this failed, I'll retry." The loop will continue iterating on failures until max iterations, which wastes tokens.

**Recommendation:** Consider adding a `signal_failure` tool that stops the loop and records why the assignment couldn't be completed, saving iteration budget.

---

### 5. CONTEXT / WORKING MEMORY

**Article guidance:** Maintain a portable `context.md` pattern — who the agent is, what resources are available, recent activity, guidelines, current state. Readable at session start.

**Current state: STRONG (8/10)**

The `context-builder.js` implementation is excellent and closely follows the article's `context.md` pattern:

```
## Identity       → Who the agent is, team composition
## System State   → World state, team statuses
## Current Work   → Active/pending/blocked tasks, pending decisions
## Other Teams    → Cross-team awareness and communications
## Recent Activity → Last 10 system activities
## Budget         → Credit usage and limits
## Guidelines     → Tool usage rules (10 specific instructions)
```

This is injected as the system prompt via `buildTeamContext()` on every agentic invocation, giving the agent full situational awareness.

**Gaps:**
- **No persistent memory across sessions.** Each invocation builds context from scratch. The article recommends accumulated context that improves over time. There is no mechanism for agents to store learnings, preferences, or patterns discovered in previous runs.
- **No user preferences or interests.** The context is purely operational (tasks, state). The article's `context.md` pattern includes user interests, communication preferences, and accumulated guidelines from user feedback.
- **Context size is unbounded.** With 100 tasks, 50 decisions, 200 activities, and 7 teams, the system prompt could become very large. There is no token budget estimation or context pruning for the system prompt, though `slice()` calls on arrays do provide soft limits.

---

### 6. SHARED WORKSPACE

**Article guidance:** Agents and users operate in the same data space. No isolated sandboxes. Both can see and modify the same entities.

**Current state: GOOD (7/10)**

The unified state in `agent-state.js` serves as a shared workspace. Agents create tasks and decisions that appear in the UI. Users can view activities, approve decisions, and modify tasks through the API. The `syncFromAgentLoop()` function merges agent-created entities back into the shared state.

**Gaps:**
- **Snapshot isolation during agent loop.** The agent loop operates on a `stateContext` snapshot built by `buildStateContext()`. If a user modifies state while the agent loop is running, those changes are invisible to the agent. Conversely, the agent's mutations to `stateContext` only merge back via `syncFromAgentLoop()` after the loop completes. This creates a brief window of inconsistency.
- **No real-time streaming.** The article emphasizes "silent agents feel broken" and recommends streaming tool calls and results to the UI in real-time. Currently, the entire agent loop runs server-side and returns results only after completion. For loops with 6 iterations and multiple API calls, this could mean 30+ seconds of silence.

---

### 7. TOOL GRADUATION PATH

**Article guidance:** Start with agent-using-primitives-in-loops (flexible), add domain tools for common operations (faster), optimize hot paths with code (deterministic). Agent retains fallback to primitives.

**Current state: EARLY STAGE (4/10)**

The system is at Step 1 of the graduation path — agents use primitive tools in loops. There are no domain shortcuts yet. For example:

- **No "standup" tool** that combines `get_tasks` + `get_recent_activity` + `report_progress` into a single optimized call for the common daily-standup pattern.
- **No "handoff" tool** that creates a task for another team and sends them a message in one atomic operation.
- **No code-optimized hot paths** for operations that happen frequently (checking system state, reporting progress).

The `execute` (non-agentic) path could be considered a "hot path optimization" for simple status checks, but it doesn't have fallback to the agentic primitives — it's a completely separate code path.

**Recommendation:** Track which tool sequences agents use most frequently. When patterns emerge (e.g., agents always call `get_system_state` → `get_tasks` → `create_task`), consider creating domain tools that combine these steps.

---

### 8. IMPROVEMENT OVER TIME

**Article guidance:** Agent apps should improve without shipping code through accumulated context, prompt refinement, and (advanced) self-modification with safety gates.

**Current state: WEAK (2/10)**

This is the architecture's most significant gap relative to the article:

- **All state is ephemeral.** `agent-state.js` explicitly notes: "State is in-memory for now (fast). DynamoDB persistence is available via the repositories in db/repositories/ and should be wired up for production durability." This means every Vercel cold start resets all tasks, decisions, activities, and agent history to empty arrays.
- **No learning from past executions.** Agents don't know what they did last time, what worked, or what the user corrected.
- **No prompt refinement mechanism.** There is no way for the user/owner to provide feedback that accumulates into the system prompt over time.
- **The DynamoDB repositories exist but are unused.** Files exist at `api/_lib/db/repositories/agents.js`, `audit.js`, `costs.js`, `consent.js`, `cookies.js` — the persistence layer is built but not connected.

**Recommendation:** This is the highest-priority architectural gap. Connect the DynamoDB repositories to persist:
1. Tasks and decisions across cold starts
2. Activity history (at least last 7 days)
3. Agent execution summaries (what worked, what didn't)
4. Owner feedback/corrections as accumulated guidelines

---

### 9. STATE MANAGEMENT — TRIPLE STATE PROBLEM

**Not from article; discovered during review.**

Despite `agent-state.js` being designated the "single source of truth," there are **three independent state stores** that can diverge:

| State Store | Location | What It Tracks |
|---|---|---|
| `agent-state.js` → `state` | `api/_lib/agent-state.js:144-188` | Teams, tasks, decisions, activities, orchestration |
| `orchestrate.js` → `orchestrationState` | `api/orchestrate.js:129-170` | Per-team status, activities, run counts, world state |
| `world-controller.js` → `worldState` | `api/_lib/world-controller.js:53-108` | Global pause, team controls, credit protection, emergency stop |

These three objects track overlapping concerns:
- **World state** is tracked in both `orchestrationState.worldState` and `worldState.worldStatus` and `state.orchestration.worldState`
- **Team pause/running status** is tracked in both `orchestrationState.teams[id].status` and `worldState.teamControls[id].paused`
- **Activities** are tracked in both `orchestrationState.teams[id].activities` and `state.activities`

The `agent-state.js` header comment even acknowledges this: "Consolidates the previously separate state stores... This fixes the triple state desynchronization problem." But the consolidation is incomplete — `orchestrate.js` still maintains its own `orchestrationState` and never imports or writes to the unified state for team status tracking.

**Evidence of divergence risk:**
```javascript
// orchestrate.js:317 - writes to its OWN state, not unified state
orchestrationState.teams[teamId].lastRun = new Date().toISOString();
orchestrationState.teams[teamId].runCount++;

// But execute-agentic also writes to orchestrationState (line 907-909)
// AND syncs to agent-state via syncFromAgentLoop
```

**Recommendation:** Complete the state consolidation. Remove `orchestrationState` from `orchestrate.js` and have it import/use `agent-state.js` exclusively. The world-controller should also read/write through `agent-state.js` rather than maintaining its own `worldState` object.

---

### 10. RESILIENCE — CIRCUIT BREAKER NOT CONNECTED

**Current state: INCOMPLETE (3/10)**

A well-implemented `CircuitBreaker` class exists at `api/_lib/circuit-breaker.js` with:
- CLOSED → OPEN → HALF_OPEN state machine
- Configurable failure/success thresholds
- Exponential backoff with jitter
- `resilientFetch()` wrapper
- Per-service circuit isolation

**However, it is never used.** Neither `agent-loop.js` nor `orchestrate.js` imports `circuit-breaker.js`. Both files make raw `fetch()` calls to the Anthropic API without circuit breaker protection:

```javascript
// agent-loop.js:249 - raw fetch, no circuit breaker
const response = await fetch('https://api.anthropic.com/v1/messages', { ... });

// orchestrate.js:272 - raw fetch, no circuit breaker
const response = await fetch('https://api.anthropic.com/v1/messages', { ... });
```

The agent loop does have a timeout (`AbortController` with 20s), but no retry logic and no circuit breaker. If the Anthropic API has a transient failure, the agent loop simply stops with an error message.

**Recommendation:** Replace raw `fetch()` calls in both `agent-loop.js` and `orchestrate.js` with `resilientFetch()` from `circuit-breaker.js`. This provides automatic retry with backoff and prevents cascading failures when the API is degraded.

---

### 11. PARTIAL COMPLETION TRACKING

**Article guidance:** Track multi-step tasks at granular level with status (pending/in-progress/completed/failed/skipped). Show progress and notes explaining failures.

**Current state: GOOD (7/10)**

Task status tracking is solid with 5 states: `pending`, `in_progress`, `completed`, `cancelled`, `blocked`. Tasks include `progress` (0-100%), `result` summary, timestamps (`createdAt`, `startedAt`, `completedAt`, `updatedAt`), and `assignedAgents`.

**Gaps:**
- No `failed` status distinct from `blocked`. The article specifically recommends tracking failures with explanatory notes.
- No `skipped` status for tasks that were deprioritized.
- Progress notes per-step are not tracked — only a single `result` string on completion.

---

### 12. AGENT-TO-UI COMMUNICATION / STREAMING

**Article guidance:** Stream events in real-time: thinking indicators, tool calls, results, text responses, status changes. "Silent agents feel broken."

**Current state: WEAK (2/10)**

The current architecture is fully synchronous request-response:

1. Client POSTs to `/api/orchestrate` with `action: execute-agentic`
2. Server runs the full agent loop (potentially 6 iterations × 20s timeout = up to 120 seconds)
3. Server returns the complete result as a single JSON response

There is no streaming, no Server-Sent Events, no WebSocket connection. The user sees nothing until the entire loop completes. For multi-team execution (`execute-agentic-all`), this could mean minutes of silence.

**Recommendation:** Implement SSE (Server-Sent Events) for agent loop execution. Emit events for:
- `iteration_start` — agent is thinking
- `tool_call` — agent is using a tool (with tool name)
- `tool_result` — tool completed (success/failure)
- `text_response` — agent produced text
- `completion` — loop finished

---

## Summary Scorecard

| Principle | Score | Priority |
|---|---|---|
| Parity (agent can do what UI does) | 6/10 | HIGH |
| Granularity (atomic tools) | 8/10 | LOW |
| Composability (features via prompts) | 5/10 | MEDIUM |
| Explicit Completion Signals | 9/10 | LOW |
| Context / Working Memory | 8/10 | MEDIUM |
| Shared Workspace | 7/10 | MEDIUM |
| Tool Graduation Path | 4/10 | LOW |
| Improvement Over Time | 2/10 | **CRITICAL** |
| State Management (internal) | 3/10 | **CRITICAL** |
| Resilience (circuit breaker) | 3/10 | HIGH |
| Partial Completion Tracking | 7/10 | LOW |
| Agent-to-UI Streaming | 2/10 | HIGH |

**Overall: 5.3 / 10**

---

## Prioritized Recommendations

### Critical (fix before scaling)

1. **Complete state consolidation.** Remove `orchestrationState` from `orchestrate.js`. All state reads/writes go through `agent-state.js`. Remove duplicate `worldState` from `world-controller.js`.

2. **Connect DynamoDB persistence.** Wire up the existing repository layer so tasks, decisions, and activities survive cold starts. Without this, the system resets to zero on every deployment.

### High Priority

3. **Connect circuit breaker.** Replace raw `fetch()` in `agent-loop.js` and `orchestrate.js` with `resilientFetch()`. The code exists; it just needs to be imported and used.

4. **Deprecate non-agentic `execute` path.** The single-shot `executeOrchestration()` function doesn't use tools, doesn't have completion signals, and relies on regex parsing. Consolidate to the agentic path.

5. **Add missing agent tools.** At minimum: `delete_task`, `resolve_decision`, `broadcast_message`. This closes the parity gap for safe operations.

6. **Implement SSE streaming.** Emit real-time events during agent loop execution so the UI can show progress.

### Medium Priority

7. **Consolidate team prompt definitions.** Single source for team prompts instead of three partial definitions across files.

8. **Add persistent agent memory.** Store execution summaries and owner feedback. Inject accumulated learnings into context on future runs.

9. **Add `signal_failure` tool.** Let agents explicitly signal "this assignment cannot be completed" with a reason, saving remaining iteration budget.

### Low Priority

10. **Track tool usage patterns for graduation.** Log which tool sequences agents call most frequently to identify domain tool candidates.

11. **Add `failed` and `skipped` task statuses.** More granular partial completion tracking.

12. **Estimate system prompt token count.** Add a token budget check in `buildTeamContext()` to warn when context is approaching model limits.

---

## Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │              Owner / CEO                     │
                    │  (UI Command Center / WhatsApp Molt Bot)     │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │           /api/orchestrate.js                │
                    │  ┌─────────────────────────────────────┐    │
                    │  │ orchestrationState ← PROBLEM:       │    │
                    │  │ duplicates agent-state.js            │    │
                    │  └─────────────────────────────────────┘    │
                    │                                             │
                    │  execute ──────► Single-shot Claude call    │
                    │  (non-agentic)   (regex parse response)     │
                    │                  ← ANTI-PATTERN             │
                    │                                             │
                    │  execute-agentic ──► runAgentLoop()         │
                    │  (agentic)           (tool-use loop)        │
                    │                      ← BEST PRACTICE        │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │          /api/_lib/agent-loop.js             │
                    │                                             │
                    │  ┌─ Claude API ──► tools ──► results ─┐    │
                    │  │                                     │    │
                    │  └─────── iterate (max 6) ◄────────────┘    │
                    │                                             │
                    │  Uses: context-builder.js (system prompt)   │
                    │        agent-tools.js (tool execution)      │
                    │        cost-tracker.js (usage recording)    │
                    │                                             │
                    │  Does NOT use: circuit-breaker.js ← GAP    │
                    └──────────────────┬──────────────────────────┘
                                       │
               ┌───────────────────────┼───────────────────────┐
               │                       │                       │
    ┌──────────▼────────┐  ┌──────────▼────────┐  ┌──────────▼────────┐
    │  agent-state.js   │  │ world-controller  │  │  agent-tools.js   │
    │  (unified state)  │  │ (own worldState)  │  │  (11 tools)       │
    │                   │  │  ← DUPLICATE      │  │                   │
    │  teams            │  │                   │  │  5 observation    │
    │  tasks            │  │  pause/resume     │  │  5 action         │
    │  decisions        │  │  credit protect   │  │  1 control        │
    │  activities       │  │  emergency stop   │  │                   │
    │  communications   │  │  automation sched │  │  Missing:         │
    │  orchestration    │  │  action queue     │  │  - delete_task    │
    │                   │  │                   │  │  - resolve_dec    │
    │  IN-MEMORY ONLY   │  │  IN-MEMORY ONLY   │  │  - broadcast      │
    │  ← CRITICAL GAP   │  │  ← CRITICAL GAP   │  │  ← PARITY GAP    │
    └───────────────────┘  └───────────────────┘  └───────────────────┘
               │
    ┌──────────▼────────┐
    │  db/repositories  │
    │  (DynamoDB)       │
    │                   │
    │  BUILT but        │
    │  NOT CONNECTED    │
    │  ← CRITICAL GAP   │
    └───────────────────┘
```

---

*Review conducted against the Agent-Native Architecture guide (every.to/guides/agent-native). All file references are relative to the repository root.*
