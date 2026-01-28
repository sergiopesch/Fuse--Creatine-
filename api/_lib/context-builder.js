/**
 * Context Builder - Dynamic Prompt Context Injection
 * ===================================================
 *
 * Builds rich system prompts that inject current system state,
 * resources, capabilities, and recent activity into agent prompts.
 *
 * Implements the guide's Context Injection and context.md patterns:
 * - Available resources and capabilities
 * - Recent activity across teams
 * - Credit/budget awareness
 * - Team-specific context
 * - Context summarization for long loops
 * - Agent memory injection
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONTEXT_LIMITS = {
  MAX_TASKS_SHOWN: 10,
  MAX_DECISIONS_SHOWN: 5,
  MAX_ACTIVITIES_SHOWN: 15,
  MAX_COMMUNICATIONS_SHOWN: 5,
  // Rough character limits for context sections
  MAX_WORK_SECTION_CHARS: 2000,
  MAX_ACTIVITY_SECTION_CHARS: 1500,
  MAX_TOTAL_CONTEXT_CHARS: 8000,
};

// =============================================================================
// MAIN BUILDER
// =============================================================================

/**
 * Build a full context-rich system prompt for a team's agent loop.
 *
 * @param {string} teamId - The team being orchestrated
 * @param {object} teamPrompt - The team's base prompt config { name, systemPrompt, agents }
 * @param {object} ctx - State context
 * @param {object} options - { iteration, memory, summarize }
 * @returns {string} Complete system prompt
 */
function buildTeamContext(teamId, teamPrompt, ctx, options = {}) {
  const sections = [];
  const { iteration = 1, memory = null, summarize = false } = options;

  // Section 1: Identity
  sections.push(buildIdentitySection(teamId, teamPrompt));

  // Section 2: Session context (iteration awareness)
  if (iteration > 1) {
    sections.push(buildSessionSection(iteration));
  }

  // Section 3: Agent memory (learned patterns, preferences)
  if (memory) {
    sections.push(buildMemorySection(memory));
  }

  // Section 4: System state
  sections.push(buildSystemStateSection(ctx));

  // Section 5: Current work (with optional summarization)
  const workSection = buildCurrentWorkSection(teamId, ctx, summarize);
  sections.push(workSection);

  // Section 6: Cross-team awareness
  sections.push(buildCrossTeamSection(teamId, ctx));

  // Section 7: Recent activity (with optional summarization)
  const activitySection = buildRecentActivitySection(ctx, summarize);
  sections.push(activitySection);

  // Section 8: Budget awareness
  sections.push(buildBudgetSection(ctx));

  // Section 9: Tools and guidelines
  sections.push(buildGuidelinesSection());

  // Combine and check total length
  let fullContext = sections.filter(Boolean).join('\n\n');

  // If context is too long and we haven't summarized yet, rebuild with summarization
  if (fullContext.length > CONTEXT_LIMITS.MAX_TOTAL_CONTEXT_CHARS && !summarize) {
    return buildTeamContext(teamId, teamPrompt, ctx, { ...options, summarize: true });
  }

  return fullContext;
}

/**
 * Build session context section for multi-iteration awareness
 */
function buildSessionSection(iteration) {
  return `## Session Context

You are in iteration ${iteration} of this work session. Previous iterations may have:
- Created tasks or decisions
- Sent messages to other teams
- Made progress on objectives

Check current state before taking action to avoid duplication.`;
}

/**
 * Build memory section from agent's learned patterns
 */
function buildMemorySection(memory) {
  if (!memory || Object.keys(memory).length === 0) return null;

  const lines = ['## Agent Memory'];

  if (memory.preferences && memory.preferences.length > 0) {
    lines.push('\nOwner preferences:');
    memory.preferences.slice(0, 5).forEach(p => {
      lines.push(`- ${p}`);
    });
  }

  if (memory.patterns && memory.patterns.length > 0) {
    lines.push('\nLearned patterns:');
    memory.patterns.slice(0, 5).forEach(p => {
      lines.push(`- ${p}`);
    });
  }

  if (memory.context && memory.context.length > 0) {
    lines.push('\nRelevant context:');
    memory.context.slice(0, 3).forEach(c => {
      lines.push(`- ${c}`);
    });
  }

  return lines.length > 1 ? lines.join('\n') : null;
}

// =============================================================================
// SECTION BUILDERS
// =============================================================================

function buildIdentitySection(teamId, teamPrompt) {
  const agentList = teamPrompt.agents
    .map((a, i) => `  ${i + 1}. ${a}`)
    .join('\n');

  return `## Identity

You are the ${teamPrompt.name} lead for FUSE, an AI-powered creatine supplement company.

Team ID: ${teamId}
Your agents:
${agentList}

You coordinate your team to accomplish tasks, create deliverables, and collaborate with other teams. You act on behalf of your agents using tools - you don't just describe what you would do, you actually do it.`;
}

function buildSystemStateSection(ctx) {
  const worldState = ctx.worldState || 'unknown';
  const teamCount = Object.keys(ctx.teams || {}).length;

  const teamSummaries = Object.entries(ctx.teams || {})
    .map(([id, team]) => {
      const status = team.status || 'paused';
      return `  - ${team.name || id} (${id}): ${status}`;
    })
    .join('\n');

  return `## System State

World state: ${worldState}
Total teams: ${teamCount}

Team statuses:
${teamSummaries}`;
}

function buildCurrentWorkSection(teamId, ctx, summarize = false) {
  const tasks = (ctx.tasks || []).filter(t => t.teamId === teamId);
  const decisions = (ctx.decisions || []).filter(d => d.teamId === teamId);

  if (tasks.length === 0 && decisions.length === 0) {
    return `## Current Work

No active tasks or pending decisions for your team.`;
  }

  const lines = ['## Current Work'];

  // If summarizing, provide compact overview
  if (summarize) {
    const activeTasks = tasks.filter(t => t.status === 'in_progress');
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const blockedTasks = tasks.filter(t => t.status === 'blocked');
    const pendingDecisions = decisions.filter(d => d.status === 'pending');

    lines.push(`\nSummary: ${activeTasks.length} active, ${pendingTasks.length} pending, ${blockedTasks.length} blocked tasks; ${pendingDecisions.length} pending decisions`);

    // Show only high-priority items
    const highPriority = [...activeTasks, ...pendingTasks, ...blockedTasks]
      .filter(t => t.priority === 'critical' || t.priority === 'high')
      .slice(0, 3);

    if (highPriority.length > 0) {
      lines.push('\nHigh-priority items:');
      highPriority.forEach(t => {
        lines.push(`  - [${t.id}] "${t.title}" (${t.status}, ${t.priority})`);
      });
    }

    lines.push('\nUse get_tasks tool for full task list.');
    return lines.join('\n');
  }

  // Full detail mode
  if (tasks.length > 0) {
    const activeTasks = tasks.filter(t => t.status === 'in_progress');
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const blockedTasks = tasks.filter(t => t.status === 'blocked');

    lines.push(`\nTasks (${tasks.length} total):`);

    if (activeTasks.length > 0) {
      lines.push(`  Active (${activeTasks.length}):`);
      activeTasks.slice(0, CONTEXT_LIMITS.MAX_TASKS_SHOWN).forEach(t => {
        lines.push(`    - [${t.id}] "${t.title}" (${t.priority}, ${t.progress || 0}% done)`);
      });
      if (activeTasks.length > CONTEXT_LIMITS.MAX_TASKS_SHOWN) {
        lines.push(`    ... and ${activeTasks.length - CONTEXT_LIMITS.MAX_TASKS_SHOWN} more`);
      }
    }

    if (pendingTasks.length > 0) {
      lines.push(`  Pending (${pendingTasks.length}):`);
      pendingTasks.slice(0, CONTEXT_LIMITS.MAX_TASKS_SHOWN).forEach(t => {
        lines.push(`    - [${t.id}] "${t.title}" (${t.priority})`);
      });
      if (pendingTasks.length > CONTEXT_LIMITS.MAX_TASKS_SHOWN) {
        lines.push(`    ... and ${pendingTasks.length - CONTEXT_LIMITS.MAX_TASKS_SHOWN} more`);
      }
    }

    if (blockedTasks.length > 0) {
      lines.push(`  Blocked (${blockedTasks.length}):`);
      blockedTasks.slice(0, 3).forEach(t => {
        lines.push(`    - [${t.id}] "${t.title}"`);
      });
    }
  }

  if (decisions.length > 0) {
    const pending = decisions.filter(d => d.status === 'pending');
    const resolved = decisions.filter(d => d.status !== 'pending');

    if (pending.length > 0) {
      lines.push(`\nPending decisions (awaiting owner):`);
      pending.slice(0, CONTEXT_LIMITS.MAX_DECISIONS_SHOWN).forEach(d => {
        lines.push(`  - [${d.id}] "${d.title}" (${d.priority})`);
      });
    }

    if (resolved.length > 0) {
      lines.push(`\nRecently resolved decisions:`);
      resolved.slice(0, 3).forEach(d => {
        lines.push(`  - "${d.title}" → ${d.status}`);
      });
    }
  }

  return lines.join('\n');
}

function buildCrossTeamSection(teamId, ctx) {
  const otherTeams = Object.entries(ctx.teams || {}).filter(([id]) => id !== teamId);

  if (otherTeams.length === 0) return null;

  const lines = ['## Other Teams'];

  otherTeams.forEach(([id, team]) => {
    const teamTasks = (ctx.tasks || []).filter(t => t.teamId === id && t.status !== 'completed');
    const activeCount = teamTasks.filter(t => t.status === 'in_progress').length;
    const pendingCount = teamTasks.filter(t => t.status === 'pending').length;

    lines.push(`- ${team.name || id}: ${activeCount} active, ${pendingCount} pending tasks`);
  });

  // Recent cross-team communications
  const recentComms = (ctx.communications || [])
    .filter(c => c.from?.teamId === teamId || c.to?.teamId === teamId)
    .slice(0, 3);

  if (recentComms.length > 0) {
    lines.push('\nRecent cross-team messages:');
    recentComms.forEach(c => {
      const direction = c.from?.teamId === teamId ? `→ ${c.to?.teamId}` : `← ${c.from?.teamId}`;
      lines.push(`  ${direction}: "${c.message.substring(0, 80)}"`);
    });
  }

  return lines.join('\n');
}

function buildRecentActivitySection(ctx, summarize = false) {
  const allActivities = ctx.activities || [];

  if (allActivities.length === 0) {
    return '## Recent Activity\n\nNo recent activity.';
  }

  const lines = ['## Recent Activity'];

  if (summarize) {
    // Summarized view - group by team and show counts
    const byTeam = {};
    allActivities.slice(0, 50).forEach(a => {
      if (!byTeam[a.teamId]) {
        byTeam[a.teamId] = { count: 0, recent: null };
      }
      byTeam[a.teamId].count++;
      if (!byTeam[a.teamId].recent) {
        byTeam[a.teamId].recent = a;
      }
    });

    lines.push(`\n${allActivities.length} total activities. Summary by team:`);
    Object.entries(byTeam).forEach(([teamId, data]) => {
      const time = formatRelativeTime(data.recent?.timestamp);
      lines.push(`- ${teamId}: ${data.count} activities (latest: ${time})`);
    });

    lines.push('\nUse get_recent_activity tool for details.');
    return lines.join('\n');
  }

  // Full detail view
  const activities = allActivities.slice(0, CONTEXT_LIMITS.MAX_ACTIVITIES_SHOWN);

  activities.forEach(a => {
    const time = formatRelativeTime(a.timestamp);
    lines.push(`- [${a.teamId}/${a.agent}] ${a.message} (${a.tag}, ${time})`);
  });

  if (allActivities.length > CONTEXT_LIMITS.MAX_ACTIVITIES_SHOWN) {
    lines.push(`... and ${allActivities.length - CONTEXT_LIMITS.MAX_ACTIVITIES_SHOWN} more activities`);
  }

  return lines.join('\n');
}

function buildBudgetSection(ctx) {
  const credit = ctx.creditStatus;
  if (!credit) return null;

  const lines = ['## Budget'];

  if (credit.daily) {
    lines.push(`Daily: $${credit.daily.spent?.toFixed(2) || '0.00'} / $${credit.daily.limit?.toFixed(2) || '50.00'} (${credit.daily.usagePercent || 0}% used)`);
  }
  if (credit.monthly) {
    lines.push(`Monthly: $${credit.monthly.spent?.toFixed(2) || '0.00'} / $${credit.monthly.limit?.toFixed(2) || '500.00'} (${credit.monthly.usagePercent || 0}% used)`);
  }
  if (credit.status && credit.status !== 'ok') {
    lines.push(`\nWARNING: Credit status is ${credit.status}. ${credit.message || ''}`);
  }

  return lines.join('\n');
}

function buildGuidelinesSection() {
  return `## Guidelines

1. USE TOOLS to take real action. Do not just describe what you would do - actually do it.
2. Create specific, actionable tasks for your team members with clear deliverables.
3. Request owner decisions for anything with significant business impact or budget implications.
4. Coordinate with other teams when work crosses boundaries using send_message.
5. Report progress on findings and analysis so the owner has visibility.
6. Call signal_completion when your assignment is fully done. Include a summary.
7. Be concise. Focus on outcomes and action, not process description.
8. Check system state first if you need context before acting.
9. Break large assignments into multiple tasks rather than one monolithic task.
10. If a task is blocked, update its status and create a decision request if needed.`;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatRelativeTime(isoString) {
  if (!isoString) return 'unknown';

  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  buildTeamContext,
};
