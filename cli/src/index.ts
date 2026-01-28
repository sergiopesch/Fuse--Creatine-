#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { status } from './commands/status';
import { report } from './commands/report';
import { task } from './commands/task';
import { queue } from './commands/queue';
import { brief } from './commands/brief';
import { sync } from './commands/sync';
import { research } from './commands/research';

const program = new Command();

program
  .name('fuse-ceo')
  .description(chalk.bold.red('FUSE Creatine CEO Console') + ' — Orchestrate your 9 teams')
  .version('1.0.0');

program
  .command('status [team]')
  .description('Get status of team(s). Use "all" or omit for overview.')
  .action(status);

program
  .command('report <type>')
  .description('Generate report (daily | weekly | <team>)')
  .action(report);

program
  .command('task <team> <description>')
  .description('Add a task to the queue for a team')
  .option('-p, --priority <level>', 'Priority: critical | high | medium | low', 'medium')
  .action(task);

program
  .command('queue <action> [args...]')
  .description('Manage task queue (list | next | done <id> "<outcome>" | clear)')
  .action(queue);

program
  .command('brief <team>')
  .description('Full context dump for a team')
  .action(brief);

program
  .command('sync')
  .description('Commit and push all changes')
  .option('-m, --message <msg>', 'Commit message')
  .action(sync);

program
  .command('research <query>')
  .description('Search research folders for topic')
  .action(research);

// Parse and execute
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  console.log(chalk.bold.red('\n  FUSE CREATINE CEO Console v1.0.0\n'));
  console.log(chalk.gray('  Britain\'s First Coffee-Optimised Creatine\n'));
  program.outputHelp();
}
