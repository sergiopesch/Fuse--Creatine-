import chalk from 'chalk';
import { readTeamContext, resolveTeamName } from '../lib/team-scanner';
import { generateDailyReport, generateWeeklyReport, generateTeamReport } from '../lib/report-generator';

export function report(type: string): void {
  switch (type) {
    case 'daily':
      console.log(chalk.bold.red('\n  Generating Daily Report...\n'));
      const daily = generateDailyReport();
      console.log(daily);
      console.log(chalk.green('  Report saved to reports/daily/\n'));
      break;

    case 'weekly':
      console.log(chalk.bold.red('\n  Generating Weekly Report...\n'));
      const weekly = generateWeeklyReport();
      console.log(weekly);
      console.log(chalk.green('  Report saved to reports/weekly/\n'));
      break;

    default:
      // Try as team name
      const teamName = resolveTeamName(type);
      if (teamName) {
        const ctx = readTeamContext(teamName);
        if (ctx) {
          const teamRpt = generateTeamReport(ctx);
          console.log(teamRpt);
        } else {
          console.log(chalk.red(`  No context found for team: ${type}`));
        }
      } else {
        console.log(chalk.red(`  Unknown report type: "${type}"`));
        console.log(chalk.gray('  Usage: fuse-ceo report <daily|weekly|team-name>'));
      }
  }
}
