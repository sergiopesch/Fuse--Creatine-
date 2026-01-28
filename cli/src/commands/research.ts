import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { RESEARCH_DIR } from '../lib/constants';

function searchFiles(dir: string, query: string, results: { file: string; matches: string[] }[]): void {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      searchFiles(fullPath, query, results);
    } else if (entry.name.endsWith('.md')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lowerContent = content.toLowerCase();
      const lowerQuery = query.toLowerCase();

      if (lowerContent.includes(lowerQuery)) {
        // Find matching lines
        const lines = content.split('\n');
        const matches: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            matches.push(`  L${i + 1}: ${lines[i].trim().substring(0, 80)}`);
          }
        }

        const relPath = path.relative(RESEARCH_DIR, fullPath);
        results.push({ file: `research/${relPath}`, matches: matches.slice(0, 5) });
      }
    }
  }
}

export function research(query: string): void {
  console.log(chalk.bold.red(`\n  FUSE CREATINE — Research Search\n`));
  console.log(chalk.gray(`  Searching for: "${query}"\n`));

  const results: { file: string; matches: string[] }[] = [];
  searchFiles(RESEARCH_DIR, query, results);

  if (results.length === 0) {
    console.log(chalk.yellow('  No results found in research/ folder.\n'));
    return;
  }

  console.log(chalk.bold(`  Found ${results.length} file(s):\n`));

  for (const result of results) {
    console.log(chalk.bold(`  📄 ${result.file}`));
    for (const match of result.matches) {
      console.log(chalk.gray(match));
    }
    console.log();
  }
}
