import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Transcripts hold private conversation. Parse only ids, timestamp, model and
// usage; never keep, return or log message content (see build-change security.md).

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreation5mTokens: number;
  cacheCreation1hTokens: number;
}

export type ClaudeUsageByDay = Record<string, Record<string, ClaudeUsage>>;

interface DedupedLine {
  key: string;
  day: string;
  model: string;
  outputTokens: number;
  usage: ClaudeUsage;
}

interface FileCacheEntry {
  mtimeMs: number;
  size: number;
  lines: DedupedLine[];
}

const fileCache = new Map<string, FileCacheEntry>();

const EMPTY_CLAUDE_USAGE: ClaudeUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreation5mTokens: 0,
  cacheCreation1hTokens: 0,
};

export function defaultProjectsDirs(homeDir: string, env: NodeJS.ProcessEnv): string[] {
  const dirs = [join(homeDir, '.claude', 'projects'), join(homeDir, '.config', 'claude', 'projects')];
  if (env.CLAUDE_CONFIG_DIR) dirs.unshift(join(env.CLAUDE_CONFIG_DIR, 'projects'));
  return [...new Set(dirs)];
}

function findJsonlFiles(rootDir: string): string[] {
  const files: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const currentDir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      continue; // missing or unreadable directory: skip it
    }
    for (const entry of entries) {
      const entryPath = join(currentDir, entry.name);
      if (entry.isDirectory()) stack.push(entryPath);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(entryPath);
    }
  }
  return files;
}

function isAssistantUsageRecord(
  record: unknown,
): record is { message: { id: string; model: string; usage: Record<string, unknown> }; requestId?: string; timestamp: string } {
  if (typeof record !== 'object' || record === null) return false;
  const candidate = record as Record<string, unknown>;
  if (candidate.type !== 'assistant' || typeof candidate.timestamp !== 'string') return false;
  const message = candidate.message;
  if (typeof message !== 'object' || message === null) return false;
  const messageCandidate = message as Record<string, unknown>;
  return (
    typeof messageCandidate.id === 'string' &&
    typeof messageCandidate.model === 'string' &&
    typeof messageCandidate.usage === 'object' &&
    messageCandidate.usage !== null
  );
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function parseLine(rawLine: string): DedupedLine | null {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;
  let record: unknown;
  try {
    record = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isAssistantUsageRecord(record)) return null;

  const usage = record.message.usage;
  const cacheCreation = usage.cache_creation as Record<string, unknown> | undefined;
  const claudeUsage: ClaudeUsage = {
    inputTokens: toNumber(usage.input_tokens),
    outputTokens: toNumber(usage.output_tokens),
    cacheReadTokens: toNumber(usage.cache_read_input_tokens),
    cacheCreation5mTokens: toNumber(cacheCreation?.ephemeral_5m_input_tokens),
    cacheCreation1hTokens: toNumber(cacheCreation?.ephemeral_1h_input_tokens),
  };

  return {
    key: `${record.message.id}\u0000${record.requestId ?? ''}`,
    day: record.timestamp.slice(0, 10),
    model: record.message.model,
    outputTokens: claudeUsage.outputTokens,
    usage: claudeUsage,
  };
}

function readFileLines(filePath: string): DedupedLine[] {
  const stat = statSync(filePath);
  const cached = fileCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.lines;

  const text = readFileSync(filePath, 'utf8');
  const lines: DedupedLine[] = [];
  for (const rawLine of text.split('\n')) {
    const parsed = parseLine(rawLine);
    if (parsed) lines.push(parsed);
  }
  fileCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, lines });
  return lines;
}

function addClaudeUsage(left: ClaudeUsage, right: ClaudeUsage): ClaudeUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheCreation5mTokens: left.cacheCreation5mTokens + right.cacheCreation5mTokens,
    cacheCreation1hTokens: left.cacheCreation1hTokens + right.cacheCreation1hTokens,
  };
}

export function readClaudeUsage(projectsDirs: string[]): ClaudeUsageByDay {
  const deduped = new Map<string, DedupedLine>();
  for (const dir of projectsDirs) {
    for (const filePath of findJsonlFiles(dir)) {
      for (const line of readFileLines(filePath)) {
        const existing = deduped.get(line.key);
        if (!existing || line.outputTokens > existing.outputTokens) deduped.set(line.key, line);
      }
    }
  }

  const byDay: ClaudeUsageByDay = {};
  for (const line of deduped.values()) {
    const byModel = (byDay[line.day] ??= {});
    byModel[line.model] = addClaudeUsage(byModel[line.model] ?? EMPTY_CLAUDE_USAGE, line.usage);
  }
  return byDay;
}
