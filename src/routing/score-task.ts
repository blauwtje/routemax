import type { Effort, WorkerTier } from '../config/config-schema';

export interface TaskScore {
  tier: WorkerTier;
  effort: Effort;
  confident: boolean;
  signals: string[];
}

const LOW_ACTION_VERBS = ['find', 'read', 'search', 'summarize', 'list', 'explain', 'describe', 'look up', 'check'];
const HIGH_ACTION_VERBS = ['build', 'implement', 'refactor', 'design', 'architect', 'migrate', 'rewrite', 'integrate'];
const REASONING_MARKERS = [
  'because', 'trade-off', 'tradeoff', 'decide', 'algorithm', 'architecture',
  'concurrency', 'edge case', 'race condition', 'why',
];
const LOW_TASK_TYPES = ['search', 'read', 'summarize'];
const HIGH_TASK_TYPES = ['build', 'refactor', 'architecture'];

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasPhrase = (text: string, phrase: string) => new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i').test(text);

function countNamedFiles(text: string): number {
  return (text.match(/\b[\w-]+\.[a-zA-Z]{1,5}\b/g) ?? []).length;
}

function hasCode(text: string): boolean {
  return /```/.test(text) || /`[^`\n]+`/.test(text) || /\b(function|class|const|def|import)\b/.test(text);
}

export function scoreTask(task: string, taskType: string): TaskScore {
  let score = 0;
  const signals: string[] = [];

  if (LOW_TASK_TYPES.includes(taskType)) {
    score -= 3;
    signals.push(`low-task-type:${taskType}`);
  }
  if (HIGH_TASK_TYPES.includes(taskType)) {
    score += 3;
    signals.push(`high-task-type:${taskType}`);
  }

  for (const verb of LOW_ACTION_VERBS) {
    if (hasPhrase(task, verb)) {
      score -= 2;
      signals.push(`low-verb:${verb}`);
    }
  }
  for (const verb of HIGH_ACTION_VERBS) {
    if (hasPhrase(task, verb)) {
      score += 2;
      signals.push(`high-verb:${verb}`);
    }
  }
  for (const marker of REASONING_MARKERS) {
    if (hasPhrase(task, marker)) {
      score += 2;
      signals.push(`reasoning:${marker}`);
    }
  }

  if (hasCode(task)) {
    score += 2;
    signals.push('code-present');
  }

  const fileCount = countNamedFiles(task);
  if (fileCount > 0) {
    score += Math.min(fileCount, 4);
    signals.push(`named-files:${fileCount}`);
  }

  const wordCount = task.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 60) {
    score += 2;
    signals.push('long-text');
  } else if (wordCount < 8) {
    score -= 1;
    signals.push('short-text');
  }

  const tier: WorkerTier = score <= -2 ? 'flash-low' : score <= 4 ? 'flash-high' : 'pro-high';
  const effort: Effort =
    score <= -2 ? 'low' : score <= 1 ? 'medium' : score <= 7 ? 'high' : score <= 11 ? 'xhigh' : 'max';
  const confident = Math.abs(score) >= 3 || signals.length >= 2;

  return { tier, effort, confident, signals };
}
