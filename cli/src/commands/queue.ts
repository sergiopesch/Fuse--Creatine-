import chalk from 'chalk';
import { getAllTasks, startNextTask, completeTask, clearCompleted, Task } from '../lib/queue-manager';

const priorityColor: Record<string, (text: string) => string> = {
  critical: chalk.red,
  high: chalk.yellow,
  medium: chalk.blue,
  low: chalk.gray
};

function formatTask(task: Task, showStatus = false): string {
  const pColor = priorityColor[task.priority] || chalk.white;
  const parts = [
    chalk.gray(`[${task.id}]`),
    pColor(task.priority.toUpperCase().padEnd(8)),
    chalk.bold(task.team.padEnd(16)),
    task.description
  ];

  if (showStatus && task.startedAt) {
    parts.push(chalk.blue(' (active)'));
  }

  return parts.join(' ');
}

export function queue(action: string, args: string[]): void {
  switch (action) {
    case 'list':
      listQueue();
      break;

    case 'next':
      nextTask();
      break;

    case 'done': {
      const id = Array.isArray(args) ? args[0] : args;
      const rest = Array.isArray(args) ? args.slice(1) : [];
      const outcome = rest.join(' ');
      if (!id) {
        console.log(chalk.red('  Usage: fuse-ceo queue done <id> "<outcome>"'));
        return;
      }
      doneTask(id, outcome || 'Completed');
      break;
    }

    case 'clear':
      clearDone();
      break;

    default:
      console.log(chalk.red(`  Unknown queue action: "${action}"`));
      console.log(chalk.gray('  Usage: fuse-ceo queue <list|next|done|clear>'));
  }
}

function listQueue(): void {
  const tasks = getAllTasks();

  console.log(chalk.bold.red('\n  FUSE CREATINE — Task Queue\n'));

  if (tasks.active.length > 0) {
    console.log(chalk.bold.blue('  Active:'));
    for (const task of tasks.active) {
      console.log(`  ▶ ${formatTask(task)}`);
    }
    console.log();
  }

  if (tasks.pending.length > 0) {
    console.log(chalk.bold('  Pending:'));
    for (const task of tasks.pending) {
      console.log(`  ○ ${formatTask(task)}`);
    }
    console.log();
  }

  if (tasks.completed.length > 0) {
    console.log(chalk.bold.green('  Completed:'));
    for (const task of tasks.completed.slice(-5)) {
      console.log(`  ✓ ${formatTask(task)} ${chalk.gray(`→ ${task.outcome || ''}`)}`);
    }
    if (tasks.completed.length > 5) {
      console.log(chalk.gray(`    ... and ${tasks.completed.length - 5} more`));
    }
    console.log();
  }

  if (tasks.active.length === 0 && tasks.pending.length === 0 && tasks.completed.length === 0) {
    console.log(chalk.gray('  Queue is empty. Add tasks with: fuse-ceo task <team> "<description>"\n'));
  }

  // Summary
  console.log(chalk.gray(`  Total: ${tasks.pending.length} pending · ${tasks.active.length} active · ${tasks.completed.length} completed\n`));
}

function nextTask(): void {
  const task = startNextTask();

  if (!task) {
    console.log(chalk.yellow('\n  No pending tasks in queue.\n'));
    return;
  }

  console.log(chalk.bold.green(`\n  ▶ Starting next task\n`));
  console.log(`  ID:       ${chalk.bold(task.id)}`);
  console.log(`  Team:     ${task.team}`);
  console.log(`  Priority: ${priorityColor[task.priority](task.priority)}`);
  console.log(`  Task:     ${task.description}`);
  console.log();
  console.log(chalk.gray(`  When done: fuse-ceo queue done ${task.id} "<outcome>"`));
  console.log();
}

function doneTask(id: string, outcome: string): void {
  const task = completeTask(id, outcome);

  if (!task) {
    console.log(chalk.red(`\n  Task not found: ${id}\n`));
    return;
  }

  console.log(chalk.bold.green(`\n  ✓ Task completed\n`));
  console.log(`  ID:      ${task.id}`);
  console.log(`  Team:    ${task.team}`);
  console.log(`  Task:    ${task.description}`);
  console.log(`  Outcome: ${outcome}`);
  console.log();
}

function clearDone(): void {
  const count = clearCompleted();
  console.log(chalk.green(`\n  Cleared ${count} completed tasks.\n`));
}
