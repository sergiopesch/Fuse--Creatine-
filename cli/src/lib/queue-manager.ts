import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { QUEUE_DIR, TeamName } from './constants';

export interface Task {
  id: string;
  team: TeamName;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  outcome?: string;
}

function generateId(): string {
  return crypto.randomBytes(4).toString('hex');
}

function readQueue(file: string): Task[] {
  const filePath = path.join(QUEUE_DIR, file);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeQueue(file: string, tasks: Task[]): void {
  const filePath = path.join(QUEUE_DIR, file);
  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2));
}

export function getPending(): Task[] {
  return readQueue('pending.json');
}

export function getActive(): Task[] {
  return readQueue('active.json');
}

export function getCompleted(): Task[] {
  return readQueue('completed.json');
}

export function addTask(team: TeamName, description: string, priority: Task['priority'] = 'medium'): Task {
  const task: Task = {
    id: generateId(),
    team,
    description,
    priority,
    createdAt: new Date().toISOString()
  };

  const pending = getPending();
  pending.push(task);

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  pending.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  writeQueue('pending.json', pending);
  return task;
}

export function startNextTask(): Task | null {
  const pending = getPending();
  if (pending.length === 0) return null;

  const task = pending.shift()!;
  task.startedAt = new Date().toISOString();

  writeQueue('pending.json', pending);

  const active = getActive();
  active.push(task);
  writeQueue('active.json', active);

  return task;
}

export function completeTask(id: string, outcome: string): Task | null {
  const active = getActive();
  const index = active.findIndex(t => t.id === id);

  if (index === -1) {
    // Check pending too
    const pending = getPending();
    const pendingIndex = pending.findIndex(t => t.id === id);
    if (pendingIndex !== -1) {
      const task = pending.splice(pendingIndex, 1)[0];
      task.completedAt = new Date().toISOString();
      task.outcome = outcome;
      writeQueue('pending.json', pending);
      const completed = getCompleted();
      completed.push(task);
      writeQueue('completed.json', completed);
      return task;
    }
    return null;
  }

  const task = active.splice(index, 1)[0];
  task.completedAt = new Date().toISOString();
  task.outcome = outcome;

  writeQueue('active.json', active);

  const completed = getCompleted();
  completed.push(task);
  writeQueue('completed.json', completed);

  return task;
}

export function clearCompleted(): number {
  const completed = getCompleted();
  const count = completed.length;
  writeQueue('completed.json', []);
  return count;
}

export function getAllTasks(): { pending: Task[]; active: Task[]; completed: Task[] } {
  return {
    pending: getPending(),
    active: getActive(),
    completed: getCompleted()
  };
}
