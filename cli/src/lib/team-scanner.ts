import * as fs from 'fs';
import * as path from 'path';
import { TEAMS, TEAMS_DIR, TEAM_CODES, TEAM_LABELS, TeamName } from './constants';

export interface TeamContext {
  name: TeamName;
  label: string;
  code: string;
  lastUpdated: string;
  orchestrationMode: string;
  currentState: string;
  activeWork: string[];
  blockers: string[];
  priorities: string[];
}

function extractSection(content: string, heading: string): string {
  const regex = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function extractListItems(section: string): string[] {
  const lines = section.split('\n');
  return lines
    .filter(line => line.match(/^[-*\[\]✅⚠️🔄⏳]\s|^\d+\.\s/))
    .map(line => line.replace(/^[-*]\s*(\[.\])?\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
}

function extractMetadata(content: string): { lastUpdated: string; mode: string } {
  const dateMatch = content.match(/\*\*Last Updated\*\*:\s*(.+)/);
  const modeMatch = content.match(/\*\*Orchestration Mode\*\*:\s*(.+)/);
  return {
    lastUpdated: dateMatch ? dateMatch[1].trim() : 'Unknown',
    mode: modeMatch ? modeMatch[1].trim() : 'manual'
  };
}

export function readTeamContext(team: TeamName): TeamContext | null {
  const contextPath = path.join(TEAMS_DIR, team, 'context.md');

  if (!fs.existsSync(contextPath)) {
    return null;
  }

  const content = fs.readFileSync(contextPath, 'utf-8');
  const meta = extractMetadata(content);
  const currentState = extractSection(content, 'Current State');
  const activeWork = extractListItems(extractSection(content, 'Active Work'));
  const blockersSection = extractSection(content, 'Blockers');
  const blockers = blockersSection
    .split('\n')
    .filter(line => line.startsWith('- **'))
    .map(line => line.replace(/^- /, '').trim());
  const prioritiesSection = extractSection(content, 'Priorities');
  const priorities = extractListItems(prioritiesSection);

  return {
    name: team,
    label: TEAM_LABELS[team],
    code: TEAM_CODES[team],
    lastUpdated: meta.lastUpdated,
    orchestrationMode: meta.mode,
    currentState,
    activeWork,
    blockers,
    priorities
  };
}

export function readAllTeamContexts(): TeamContext[] {
  const contexts: TeamContext[] = [];
  for (const team of TEAMS) {
    const ctx = readTeamContext(team);
    if (ctx) {
      contexts.push(ctx);
    }
  }
  return contexts;
}

export function readTeamFile(team: TeamName, filename: string): string | null {
  const filePath = path.join(TEAMS_DIR, team, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export function resolveTeamName(input: string): TeamName | null {
  const lower = input.toLowerCase();

  // Exact match
  if (TEAMS.includes(lower as TeamName)) {
    return lower as TeamName;
  }

  // Match by code
  for (const team of TEAMS) {
    if (TEAM_CODES[team].toLowerCase() === lower) {
      return team;
    }
  }

  // Partial match
  const match = TEAMS.find(t => t.startsWith(lower));
  if (match) return match;

  // Label match
  for (const team of TEAMS) {
    if (TEAM_LABELS[team].toLowerCase() === lower) {
      return team;
    }
  }

  return null;
}
