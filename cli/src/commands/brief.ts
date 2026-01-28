import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { resolveTeamName, readTeamFile } from '../lib/team-scanner';
import { TEAMS_DIR, TEAM_LABELS } from '../lib/constants';

export function brief(teamInput: string): void {
  const teamName = resolveTeamName(teamInput);

  if (!teamName) {
    console.log(chalk.red(`  Unknown team: "${teamInput}"`));
    console.log(chalk.gray('  Available teams: developers, product, marketing, sales, branding, legal, comms, digital-content, rnd'));
    return;
  }

  console.log(chalk.bold.red(`\n  FUSE CREATINE — ${TEAM_LABELS[teamName]} Team Brief\n`));
  console.log(chalk.gray('  ═'.repeat(40)));

  // Read and display TEAM.md
  const teamMd = readTeamFile(teamName, 'TEAM.md');
  if (teamMd) {
    console.log(chalk.bold('\n  ── TEAM IDENTITY ──\n'));
    console.log(teamMd);
  }

  // Read and display context.md
  const contextMd = readTeamFile(teamName, 'context.md');
  if (contextMd) {
    console.log(chalk.bold('\n  ── CURRENT CONTEXT ──\n'));
    console.log(contextMd);
  }

  // List other files in the team directory
  const teamDir = path.join(TEAMS_DIR, teamName);
  if (fs.existsSync(teamDir)) {
    const files = fs.readdirSync(teamDir).filter(f => f.endsWith('.md') && f !== 'TEAM.md' && f !== 'context.md');

    if (files.length > 0) {
      console.log(chalk.bold('\n  ── ADDITIONAL DOCS ──\n'));
      for (const file of files) {
        console.log(`  📄 teams/${teamName}/${file}`);
      }
      console.log();
    }
  }
}
