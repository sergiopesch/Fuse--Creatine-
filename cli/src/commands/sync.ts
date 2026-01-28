import chalk from 'chalk';
import { gitSync, gitStatus } from '../lib/git-utils';

export function sync(options: { message?: string }): void {
  console.log(chalk.bold.red('\n  FUSE CREATINE — Sync\n'));

  // Check status first
  const currentStatus = gitStatus();

  if (!currentStatus.trim()) {
    console.log(chalk.gray('  No changes to sync. Working tree clean.\n'));
    return;
  }

  console.log(chalk.bold('  Changes:'));
  console.log(currentStatus.split('\n').map(l => `  ${l}`).join('\n'));
  console.log();

  const message = options.message || `FUSE: Update ${new Date().toISOString().split('T')[0]}`;

  console.log(chalk.gray(`  Committing: "${message}"\n`));

  const result = gitSync(message);

  console.log(`  Commit: ${result.commit}`);
  console.log(`  Push:   ${result.push}`);
  console.log();
}
