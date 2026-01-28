# Agent Architecture: Design Decisions & Rationale

**Document Version:** 1.0
**Last Updated:** 2026-01-28

This document explains the key architectural decisions in the FUSE agent ecosystem and their rationale based on agent-native best practices.

---

## 1. Orchestration Pattern

### Decision
Implement a **loop-based agentic orchestration** with explicit completion signaling.

### Rationale
- **Single-shot responses** are insufficient for complex tasks
- Agents need to observe, act, and evaluate iteratively
- Explicit `signal_completion` prevents premature termination and heuristic guessing

### Implementation
```
api/_lib/agent-loop.js
- MAX_ITERATIONS: 6 (configurable)
- Loop: Call API → Execute tools → Feed results → Repeat
- Termination: signal_completion OR max iterations
```

### Trade-offs
- More API calls = higher cost
- Mitigated by: Cost tracking, credit limits, efficient tool design

---

## 2. Tool Design Philosophy

### Decision
Design tools as **atomic primitives** following the principle: "One conceptual action per tool."

### Rationale
- Bundled tools (e.g., `analyze_and_report()`) remove agent judgment
- Atomic tools enable emergent capability through composition
- Decision logic belongs in prompts, not tool code

### Tool Categories

| Category | Tools | Purpose |
|----------|-------|---------|
| Observation | `get_system_state`, `get_tasks`, `get_decisions`, `get_team_info`, `get_recent_activity` | Read-only state queries |
| Action | `create_task`, `update_task_status`, `delete_task`, `resolve_decision`, `create_decision_request`, `send_message`, `report_progress` | State mutations |
| Primitive | `read_workspace_file`, `write_workspace_file`, `list_workspace_files`, `search_workspace` | File operations for emergent capability |
| Control | `signal_completion` | Loop termination |

### Implementation
```
api/_lib/agent-tools.js
- 17 tools total (6 observation, 8 action, 3 primitive, 1 control)
- All tools return { success, message, data }
- Tools mutate shared state context
```

---

## 3. Human-in-the-Loop Controls

### Decision
Implement a **multi-tier control hierarchy** with granular automation levels.

### Rationale
- Full autonomy is dangerous without oversight
- Different tasks require different levels of human involvement
- Emergency stop capability is essential

### Control Hierarchy

```
World Level (global)
├── PAUSED: All operations stopped
├── MANUAL: Owner triggers every action
├── SEMI_AUTO: Selective automation with approval gates
└── AUTONOMOUS: Full team independence

Team Level (per-team)
├── STOPPED: Team completely disabled
├── MANUAL: All actions need approval
├── SUPERVISED: Major decisions need approval
└── AUTONOMOUS: Team operates independently
```

### Implementation
```
api/_lib/world-controller.js
- Global pause/resume
- Per-team automation levels
- Credit protection hard stops ($50 daily, $500 monthly default)
- Emergency stop with confirmation code
- Action queue for approval flow
```

### Why World Control is Owner-Only
Agents cannot pause/resume the world or other teams by design. This prevents:
- Runaway automation
- Agent self-modification of constraints
- Accidental system lockout

---

## 4. State Management

### Decision
**Unified in-memory state** with optional DynamoDB persistence and debounced writes.

### Rationale
- In-memory state is fast for real-time operations
- Persistence ensures durability across restarts
- Debouncing prevents excessive database writes

### Implementation
```
api/_lib/agent-state.js
- Single state object (teams, tasks, decisions, activities, communications)
- Mutator functions trigger persistence sync
- 1-second debounce on writes
- loadStateFromDatabase() on startup
- flushToDatabase() for graceful shutdown
```

### Persistence Toggle
```
ENABLE_DB_PERSISTENCE=true  # Enable DynamoDB sync
```

---

## 5. Checkpointing & Resilience

### Decision
Implement **checkpoint-based resume** for agent loop resilience.

### Rationale
- Long-running loops may fail mid-execution
- Without checkpointing, work restarts from scratch
- Checkpoints enable resume from last known state

### Checkpoint Structure
```javascript
{
  sessionId: string,
  teamId: string,
  task: string,
  iteration: number,
  messages: array,        // Full conversation history
  stateContext: object,   // State snapshot
  toolCalls: array,       // All tool invocations
  result: object,
  status: 'running' | 'completed' | 'failed' | 'interrupted',
  createdAt: ISO8601,
  updatedAt: ISO8601
}
```

### Implementation
```
api/_lib/checkpoint-manager.js
- Checkpoint saved after each iteration
- 24-hour retention for completed/failed
- 10 max checkpoints per team
- Resume via resumeAgentLoop(sessionId, stateContext, options)
```

---

## 6. Real-Time Communication (SSE)

### Decision
Use **Server-Sent Events** for real-time agent-to-UI communication.

### Rationale
- Silent agents feel broken to users
- Users need visibility into agent thinking and progress
- SSE is simpler than WebSockets for one-way streaming

### Event Types
```javascript
{
  type: 'thinking' | 'tool_call' | 'tool_result' |
        'task_created' | 'decision_created' | 'message_sent' |
        'iteration_started' | 'iteration_completed' |
        'loop_started' | 'loop_completed' | 'error',
  timestamp: ISO8601,
  // ... event-specific data
}
```

### Implementation
```
api/orchestrate-stream.js
- POST to initiate streaming orchestration
- SSE headers for real-time updates
- 15-second heartbeat for connection keep-alive
- Clean shutdown on completion or error
```

---

## 7. Context Management

### Decision
Implement **dynamic context injection** with automatic summarization.

### Rationale
- Agents need rich context to make good decisions
- Too much context wastes tokens and may exceed limits
- Summarization preserves essential info when context is large

### Context Sections
1. Identity (team, agents, role)
2. Session context (iteration awareness)
3. Agent memory (learned patterns)
4. System state (world status, teams)
5. Current work (tasks, decisions)
6. Cross-team awareness
7. Recent activity
8. Budget status
9. Guidelines

### Summarization Triggers
- Total context > 8000 characters
- Automatic rebuild with `summarize: true`
- High-priority items preserved, others summarized

### Implementation
```
api/_lib/context-builder.js
- buildTeamContext(teamId, teamPrompt, ctx, options)
- CONTEXT_LIMITS configuration
- Automatic summarization fallback
```

---

## 8. Agent Memory

### Decision
Implement **persistent agent memory** for cross-session learning.

### Rationale
- Agents should learn from interactions over time
- Owner preferences should be remembered
- Patterns help optimize future interactions

### Memory Types
```javascript
{
  preferences: [],    // Owner's stated/inferred preferences
  patterns: [],       // Behavioral patterns (with occurrence counts)
  context: [],        // Background information
  interactions: []    // Interaction summaries
}
```

### Learning Triggers
- After each completed agent loop
- Frequent tool usage patterns
- Cross-team coordination patterns
- Efficient completion patterns

### Implementation
```
api/_lib/agent-memory.js
- File-based storage (.agent-memory/)
- learnFromInteraction() for automatic learning
- getMemoryForContext() for prompt injection
```

---

## 9. Workspace Files

### Decision
Provide **sandboxed workspace** for agent file operations.

### Rationale
- Agents need to create/read documents for emergent capability
- Unrestricted file access is a security risk
- Workspace boundary prevents directory traversal

### Security Measures
```javascript
- AGENT_WORKSPACE_ROOT environment variable
- Path sanitization (remove .., normalize)
- Boundary check (fullPath.startsWith(WORKSPACE_ROOT))
- Content size limits (50KB max read)
```

### Implementation
```
api/_lib/agent-tools.js
- read_workspace_file, write_workspace_file
- list_workspace_files, search_workspace
- Default: ./agent-workspace/
```

---

## 10. Error Handling

### Decision
Implement **circuit breaker pattern** with exponential backoff.

### Rationale
- External API failures shouldn't cascade
- Automatic recovery after transient failures
- Graceful degradation when services are down

### Circuit States
```
CLOSED → (5 failures) → OPEN → (30s) → HALF_OPEN → (2 successes) → CLOSED
```

### Implementation
```
api/_lib/circuit-breaker.js
- Per-service circuit isolation
- Configurable thresholds
- Exponential backoff with jitter
- Fallback responses
```

---

## Summary of Files

| File | Purpose |
|------|---------|
| `agent-loop.js` | Agentic runtime loop with checkpointing |
| `agent-tools.js` | Tool definitions and handlers |
| `agent-state.js` | Unified state management with persistence |
| `context-builder.js` | Dynamic context injection with summarization |
| `checkpoint-manager.js` | Loop resilience and resume |
| `agent-memory.js` | Cross-session learning |
| `world-controller.js` | Human-in-the-loop controls |
| `circuit-breaker.js` | Error resilience |
| `orchestrate-stream.js` | SSE real-time communication |

---

## Future Considerations

1. **Multi-agent collaboration**: Direct agent-to-agent communication beyond messaging
2. **Adaptive iteration limits**: Dynamic based on task complexity
3. **Memory consolidation**: Periodic summarization of old memories
4. **Tool versioning**: Backwards-compatible tool evolution
5. **A/B testing**: Compare orchestration strategies

---

## References

- [Agent-Native Architecture Guide](https://every.to/guides/agent-native)
- [Anthropic Tool Use Documentation](https://docs.anthropic.com/claude/docs/tool-use)
- [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
