import chalk from 'chalk';
import { resolveTeamName } from '../lib/team-scanner';
import { addTask, Task } from '../lib/queue-manager';

export function task(teamInput: string, description: string, options: { priority?: string }): void {
  const teamName = resolveTeamName(teamInput);

  if (!teamName) {
    console.log(chalk.red(`  Unknown team: "${teamInput}"`));
    console.log(chalk.gray('  Available teams: developers, product, marketing, sales, branding, legal, comms, digital-content, rnd'));
    return;
  }

  const priority = (options.priority || 'medium') as Task['priority'];
  const validPriorities = ['critical', 'high', 'medium', 'low'];

  if (!validPriorities.includes(priority)) {
    console.log(chalk.red(`  Invalid priority: "${priority}"`));
    console.log(chalk.gray('  Valid priorities: critical, high, medium, low'));
    return;
  }

  const newTask = addTask(teamName, description, priority);

  const priorityColor = {
    critical: chalk.red,
    high: chalk.yellow,
    medium: chalk.blue,
    low: chalk.gray
  };

  console.log(chalk.bold.green(`\n  ✓ Task added to queue\n`));
  console.log(`  ID:       ${chalk.bold(newTask.id)}`);
  console.log(`  Team:     ${teamName}`);
  console.log(`  Priority: ${priorityColor[priority](priority)}`);
  console.log(`  Task:     ${description}`);
  console.log();
}
