import * as path from 'path';

export const TEAMS = [
  'developers',
  'product',
  'marketing',
  'sales',
  'branding',
  'legal',
  'comms',
  'digital-content',
  'rnd'
] as const;

export type TeamName = typeof TEAMS[number];

export const TEAM_CODES: Record<TeamName, string> = {
  'developers': 'DEV',
  'product': 'PRD',
  'marketing': 'MKT',
  'sales': 'SLS',
  'branding': 'BRD',
  'legal': 'LGL',
  'comms': 'COM',
  'digital-content': 'DCT',
  'rnd': 'R&D'
};

export const TEAM_LABELS: Record<TeamName, string> = {
  'developers': 'Developers',
  'product': 'Product',
  'marketing': 'Marketing',
  'sales': 'Sales',
  'branding': 'Branding',
  'legal': 'Legal',
  'comms': 'Comms',
  'digital-content': 'Digital Content',
  'rnd': 'R&D'
};

// Root of the FUSE project (parent of cli/)
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
export const TEAMS_DIR = path.join(PROJECT_ROOT, 'teams');
export const QUEUE_DIR = path.join(PROJECT_ROOT, 'queue');
export const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');
export const RESEARCH_DIR = path.join(PROJECT_ROOT, 'research');
export const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
