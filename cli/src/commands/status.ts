import chalk from 'chalk';
import { readAllTeamContexts, readTeamContext, resolveTeamName } from '../lib/team-scanner';
import { getAllTasks } from '../lib/queue-manager';

export function status(team?: string): void {
  if (!team || team === 'all') {
    showAllStatus();
  } else {
    showTeamStatus(team);
  }
}

function showAllStatus(): void {
  console.log(chalk.bold.red('\n  FUSE CREATINE — Status Overview\n'));

  const contexts = readAllTeamContexts();
  const tasks = getAllTasks();

  // Queue summary
  console.log(chalk.bold('  Queue:') + ` ${tasks.pending.length} pending · ${tasks.active.length} active · ${tasks.completed.length} completed\n`);

  // Critical items
  const criticalTasks = [...tasks.pending, ...tasks.active].filter(t => t.priority === 'critical');
  if (criticalTasks.length > 0) {
    console.log(chalk.bold.yellow('  ⚠ Critical Tasks:'));
    for (const task of criticalTasks) {
      console.log(chalk.yellow(`    → [${task.team.toUpperCase()}] ${task.description}`));
    }
    console.log();
  }

  // Team statuses
  console.log(chalk.bold('  Teams:\n'));

  const codeWidth = 5;
  const labelWidth = 16;

  for (const ctx of contexts) {
    const hasBlockers = ctx.blockers.length > 0;
    const statusIcon = hasBlockers ? chalk.yellow('⚠') : chalk.green('✓');
    const code = chalk.gray(`[${ctx.code}]`.padEnd(codeWidth));
    const label = ctx.label.padEnd(labelWidth);
    const state = ctx.currentState.split('\n')[0].substring(0, 60);

    console.log(`  ${statusIcon} ${code} ${chalk.bold(label)} ${chalk.gray(state)}`);

    if (hasBlockers) {
      for (const blocker of ctx.blockers) {
        console.log(chalk.yellow(`           ↳ ${blocker.substring(0, 70)}`));
      }
    }
  }

  console.log();
}

function showTeamStatus(teamInput: string): void {
  const teamName = resolveTeamName(teamInput);

  if (!teamName) {
    console.log(chalk.red(`  Unknown team: "${teamInput}"`));
    console.log(chalk.gray('  Available teams: developers, product, marketing, sales, branding, legal, comms, digital-content, rnd'));
    return;
  }

  const ctx = readTeamContext(teamName);

  if (!ctx) {
    console.log(chalk.red(`  No context found for team: ${teamName}`));
    return;
  }

  console.log(chalk.bold.red(`\n  ${ctx.label} Team`) + chalk.gray(` [${ctx.code}]`) + chalk.gray(` · ${ctx.orchestrationMode} mode · Updated ${ctx.lastUpdated}\n`));

  console.log(chalk.bold('  Current State:'));
  console.log(`  ${ctx.currentState}\n`);

  if (ctx.activeWork.length > 0) {
    console.log(chalk.bold('  Active Work:'));
    for (const item of ctx.activeWork) {
      console.log(`  ☐ ${item}`);
    }
    console.log();
  }

  if (ctx.blockers.length > 0) {
    console.log(chalk.bold.yellow('  Blockers:'));
    for (const blocker of ctx.blockers) {
      console.log(chalk.yellow(`  ⚠ ${blocker}`));
    }
    console.log();
  }

  if (ctx.priorities.length > 0) {
    console.log(chalk.bold('  Priorities:'));
    for (const priority of ctx.priorities) {
      console.log(`  → ${priority}`);
    }
    console.log();
  }

  // Show team tasks from queue
  const tasks = getAllTasks();
  const teamTasks = [...tasks.pending, ...tasks.active].filter(t => t.team === teamName);
  if (teamTasks.length > 0) {
    console.log(chalk.bold('  Queued Tasks:'));
    for (const task of teamTasks) {
      const status = task.startedAt ? chalk.blue('ACTIVE') : chalk.gray('PENDING');
      console.log(`  [${status}] ${task.description} (${task.priority}) — ID: ${task.id}`);
    }
    console.log();
  }
}
