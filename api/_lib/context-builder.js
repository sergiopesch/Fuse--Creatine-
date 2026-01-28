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
 */

// =============================================================================
// TOKEN BUDGET
// =============================================================================

const TOKEN_BUDGET = {
  MAX_SYSTEM_PROMPT_TOKENS: 4000, // Keep system prompt under ~4k tokens
  CHARS_PER_TOKEN: 4,             // Rough estimate: 1 token ≈ 4 chars
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
 * @returns {string} Complete system prompt
 */
function buildTeamContext(teamId, teamPrompt, ctx) {
  const sections = [];

  // Section 1: Identity
  sections.push(buildIdentitySection(teamId, teamPrompt));

  // Section 2: System state
  sections.push(buildSystemStateSection(ctx));

  // Section 3: Current work
  sections.push(buildCurrentWorkSection(teamId, ctx));

  // Section 4: Cross-team awareness
  sections.push(buildCrossTeamSection(teamId, ctx));

  // Section 5: Recent activity
  sections.push(buildRecentActivitySection(ctx));

  // Section 6: Budget awareness
  sections.push(buildBudgetSection(ctx));

  // Section 7: Memory (execution history, owner feedback, learned guidelines)
  sections.push(buildMemorySection(ctx));

  // Section 8: Tools and guidelines
  sections.push(buildGuidelinesSection());

  // Token budget estimation
  const fullPrompt = sections.filter(Boolean).join('\n\n');
  const estimatedTokens = estimateTokenCount(fullPrompt);

  // If we're over budget, trim the less critical sections
  if (estimatedTokens > TOKEN_BUDGET.MAX_SYSTEM_PROMPT_TOKENS) {
    return trimToTokenBudget(sections);
  }

  return fullPrompt;
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

function buildCurrentWorkSection(teamId, ctx) {
  const tasks = (ctx.tasks || []).filter(t => t.teamId === teamId);
  const decisions = (ctx.decisions || []).filter(d => d.teamId === teamId);

  if (tasks.length === 0 && decisions.length === 0) {
    return `## Current Work

No active tasks or pending decisions for your team.`;
  }

  const lines = ['## Current Work'];

  if (tasks.length > 0) {
    const activeTasks = tasks.filter(t => t.status === 'in_progress');
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const blockedTasks = tasks.filter(t => t.status === 'blocked');

    lines.push(`\nTasks (${tasks.length} total):`);

    if (activeTasks.length > 0) {
      lines.push(`  Active (${activeTasks.length}):`);
      activeTasks.slice(0, 5).forEach(t => {
        lines.push(`    - [${t.id}] "${t.title}" (${t.priority}, ${t.progress || 0}% done)`);
      });
    }

    if (pendingTasks.length > 0) {
      lines.push(`  Pending (${pendingTasks.length}):`);
      pendingTasks.slice(0, 5).forEach(t => {
        lines.push(`    - [${t.id}] "${t.title}" (${t.priority})`);
      });
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
      pending.slice(0, 5).forEach(d => {
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

function buildRecentActivitySection(ctx) {
  const activities = (ctx.activities || []).slice(0, 10);

  if (activities.length === 0) {
    return '## Recent Activity\n\nNo recent activity.';
  }

  const lines = ['## Recent Activity'];

  activities.forEach(a => {
    const time = formatRelativeTime(a.timestamp);
    lines.push(`- [${a.teamId}/${a.agent}] ${a.message} (${a.tag}, ${time})`);
  });

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

function buildMemorySection(ctx) {
  const memory = ctx.memory;
  if (!memory) return null;

  const lines = ['## Memory'];
  let hasContent = false;

  // Recent execution history
  const recentExecutions = memory.recentExecutions || [];
  if (recentExecutions.length > 0) {
    hasContent = true;
    lines.push('\nRecent executions:');
    recentExecutions.slice(0, 3).forEach(exec => {
      const status = exec.completed ? 'completed' : 'incomplete';
      lines.push(`  - [${exec.teamName || exec.teamId}] ${exec.summary?.substring(0, 100) || 'No summary'} (${status}, ${exec.iterations || 0} iterations)`);
    });
  }

  // Owner guidelines
  const guidelines = memory.ownerGuidelines || [];
  if (guidelines.length > 0) {
    hasContent = true;
    lines.push('\nOwner guidelines:');
    guidelines.slice(0, 5).forEach((g, i) => {
      lines.push(`  ${i + 1}. ${typeof g === 'string' ? g : g.guideline || g.text || JSON.stringify(g)}`);
    });
  }

  // Recent feedback
  const feedback = memory.recentFeedback || [];
  if (feedback.length > 0) {
    hasContent = true;
    lines.push('\nRecent owner feedback:');
    feedback.slice(0, 3).forEach(f => {
      const text = typeof f === 'string' ? f : f.feedback || f.message || JSON.stringify(f);
      lines.push(`  - ${text.substring(0, 120)}`);
    });
  }

  if (!hasContent) return null;

  return lines.join('\n');
}

// =============================================================================
// TOKEN BUDGETING
// =============================================================================

function estimateTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(text.length / TOKEN_BUDGET.CHARS_PER_TOKEN);
}

/**
 * Trim sections to fit within token budget.
 * Priority order (highest to lowest): Identity, Guidelines, System State,
 * Current Work, Budget, Memory, Cross-Team, Recent Activity
 */
function trimToTokenBudget(sections) {
  const maxChars = TOKEN_BUDGET.MAX_SYSTEM_PROMPT_TOKENS * TOKEN_BUDGET.CHARS_PER_TOKEN;

  // Filter out nulls
  const validSections = sections.filter(Boolean);

  // If it fits, return as-is
  const full = validSections.join('\n\n');
  if (full.length <= maxChars) return full;

  // Remove sections from the end (least critical) until we fit
  // Sections are ordered by priority in buildTeamContext
  const trimmed = [...validSections];
  while (trimmed.length > 2 && trimmed.join('\n\n').length > maxChars) {
    // Remove the second-to-last section (keep guidelines last)
    trimmed.splice(trimmed.length - 2, 1);
  }

  return trimmed.join('\n\n');
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
  estimateTokenCount,
  TOKEN_BUDGET,
};
