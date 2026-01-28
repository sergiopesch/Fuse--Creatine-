import * as fs from 'fs';
import * as path from 'path';
import { REPORTS_DIR } from './constants';
import { readAllTeamContexts, TeamContext } from './team-scanner';
import { getAllTasks } from './queue-manager';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export function generateDailyReport(): string {
  const today = formatDate(new Date());
  const contexts = readAllTeamContexts();
  const tasks = getAllTasks();

  let report = `# FUSE Creatine — Daily Report\n\n`;
  report += `**Date**: ${today}\n\n`;
  report += `---\n\n`;

  // Queue summary
  report += `## Task Queue\n\n`;
  report += `| Status | Count |\n`;
  report += `|--------|-------|\n`;
  report += `| Pending | ${tasks.pending.length} |\n`;
  report += `| Active | ${tasks.active.length} |\n`;
  report += `| Completed Today | ${tasks.completed.filter(t => t.completedAt?.startsWith(today)).length} |\n\n`;

  if (tasks.active.length > 0) {
    report += `### Active Tasks\n\n`;
    for (const task of tasks.active) {
      report += `- **[${task.team.toUpperCase()}]** ${task.description} (${task.priority})\n`;
    }
    report += `\n`;
  }

  if (tasks.pending.length > 0) {
    report += `### Pending Tasks\n\n`;
    for (const task of tasks.pending) {
      report += `- **[${task.team.toUpperCase()}]** ${task.description} (${task.priority})\n`;
    }
    report += `\n`;
  }

  // Team summaries
  report += `## Team Status\n\n`;

  for (const ctx of contexts) {
    report += `### ${ctx.label} (${ctx.code})\n\n`;
    report += `**State**: ${ctx.currentState.split('\n')[0]}\n\n`;

    if (ctx.blockers.length > 0) {
      report += `**Blockers**: ${ctx.blockers.join('; ')}\n\n`;
    }

    if (ctx.priorities.length > 0) {
      report += `**Top Priority**: ${ctx.priorities[0]}\n\n`;
    }
  }

  // Save report
  const reportDir = path.join(REPORTS_DIR, 'daily');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, `${today}.md`);
  fs.writeFileSync(reportPath, report);

  return report;
}

export function generateWeeklyReport(): string {
  const week = getWeekNumber(new Date());
  const contexts = readAllTeamContexts();
  const tasks = getAllTasks();

  let report = `# FUSE Creatine — Weekly Report\n\n`;
  report += `**Week**: ${week}\n\n`;
  report += `---\n\n`;

  // Overview
  report += `## Overview\n\n`;
  const totalBlockers = contexts.reduce((sum, ctx) => sum + ctx.blockers.length, 0);
  report += `- **Teams**: ${contexts.length} active\n`;
  report += `- **Total Blockers**: ${totalBlockers}\n`;
  report += `- **Tasks Completed**: ${tasks.completed.length}\n`;
  report += `- **Tasks Pending**: ${tasks.pending.length}\n`;
  report += `- **Tasks Active**: ${tasks.active.length}\n\n`;

  // Critical items
  const criticalTasks = [...tasks.pending, ...tasks.active].filter(t => t.priority === 'critical');
  if (criticalTasks.length > 0) {
    report += `## Critical Items\n\n`;
    for (const task of criticalTasks) {
      report += `- **[${task.team.toUpperCase()}]** ${task.description}\n`;
    }
    report += `\n`;
  }

  // Team details
  report += `## Team Details\n\n`;
  for (const ctx of contexts) {
    report += `### ${ctx.label} (${ctx.code})\n\n`;
    report += `**Mode**: ${ctx.orchestrationMode} | **Updated**: ${ctx.lastUpdated}\n\n`;
    report += `${ctx.currentState.split('\n')[0]}\n\n`;

    if (ctx.activeWork.length > 0) {
      report += `**Active Work**:\n`;
      for (const item of ctx.activeWork.slice(0, 3)) {
        report += `- ${item}\n`;
      }
      report += `\n`;
    }

    if (ctx.blockers.length > 0) {
      report += `**Blockers**:\n`;
      for (const blocker of ctx.blockers) {
        report += `- ${blocker}\n`;
      }
      report += `\n`;
    }
  }

  // Completed tasks
  if (tasks.completed.length > 0) {
    report += `## Completed Tasks\n\n`;
    for (const task of tasks.completed) {
      report += `- **[${task.team.toUpperCase()}]** ${task.description}`;
      if (task.outcome) {
        report += ` → ${task.outcome}`;
      }
      report += `\n`;
    }
    report += `\n`;
  }

  // Save report
  const reportDir = path.join(REPORTS_DIR, 'weekly');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, `${week}.md`);
  fs.writeFileSync(reportPath, report);

  return report;
}

export function generateTeamReport(teamContext: TeamContext): string {
  let report = `# ${teamContext.label} Team Report\n\n`;
  report += `**Code**: ${teamContext.code} | **Mode**: ${teamContext.orchestrationMode} | **Updated**: ${teamContext.lastUpdated}\n\n`;
  report += `---\n\n`;
  report += `## Current State\n\n${teamContext.currentState}\n\n`;

  if (teamContext.activeWork.length > 0) {
    report += `## Active Work\n\n`;
    for (const item of teamContext.activeWork) {
      report += `- ${item}\n`;
    }
    report += `\n`;
  }

  if (teamContext.blockers.length > 0) {
    report += `## Blockers\n\n`;
    for (const blocker of teamContext.blockers) {
      report += `- ${blocker}\n`;
    }
    report += `\n`;
  }

  if (teamContext.priorities.length > 0) {
    report += `## Priorities\n\n`;
    for (const priority of teamContext.priorities) {
      report += `- ${priority}\n`;
    }
    report += `\n`;
  }

  return report;
}
