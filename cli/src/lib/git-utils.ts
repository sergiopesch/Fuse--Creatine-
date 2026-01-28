import { execSync } from 'child_process';
import { PROJECT_ROOT } from './constants';

export function gitStatus(): string {
  try {
    return execSync('git status --short', { cwd: PROJECT_ROOT, encoding: 'utf-8' });
  } catch {
    return 'Error: Unable to get git status';
  }
}

export function gitAdd(): void {
  execSync('git add -A', { cwd: PROJECT_ROOT });
}

export function gitCommit(message: string): string {
  try {
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8'
    });
    return 'Committed successfully';
  } catch (error: any) {
    return `Commit failed: ${error.message}`;
  }
}

export function gitPush(): string {
  try {
    execSync('git push', { cwd: PROJECT_ROOT, encoding: 'utf-8' });
    return 'Pushed successfully';
  } catch (error: any) {
    return `Push failed: ${error.message}`;
  }
}

export function gitSync(message: string): { status: string; commit: string; push: string } {
  const status = gitStatus();
  gitAdd();
  const commit = gitCommit(message);
  const push = gitPush();
  return { status, commit, push };
}
