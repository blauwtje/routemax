import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeClaudeUsage, readClaudeUsageStore, recordClaudeUsage } from '../src/claude-usage/claude-usage-store';
import { claudeUsagePath } from '../src/config/routemax-paths';
import type { ClaudeUsage } from '../src/claude-usage/read-claude-usage';

const EMPTY_USAGE: ClaudeUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreation5mTokens: 0,
  cacheCreation1hTokens: 0,
};

function tempPath(): string {
  return claudeUsagePath(mkdtempSync(join(tmpdir(), 'routemax-claude-usage-')));
}

describe('claudeUsagePath', () => {
  it('lives beside the routemax backups', () => {
    expect(claudeUsagePath('/home/test')).toBe('/home/test/.local/state/routemax/claude-usage.json');
  });
});

describe('readClaudeUsageStore', () => {
  it('reads an empty store before the first write', () => {
    expect(readClaudeUsageStore(tempPath())).toEqual({ days: {} });
  });
});

describe('mergeClaudeUsage', () => {
  it('prices freshly read usage and adds it under its day and model', () => {
    const usage = { ...EMPTY_USAGE, inputTokens: 1_000_000 };
    const merged = mergeClaudeUsage({ days: {} }, { '2026-09-20': { 'claude-sonnet-4-5': usage } });
    expect(merged).toEqual({ days: { '2026-09-20': { 'claude-sonnet-4-5': { usage, costUsd: 3 } } } });
  });

  it('prices an unknown model as null cost rather than guessing a rate', () => {
    const usage = { ...EMPTY_USAGE, inputTokens: 1_000_000 };
    const merged = mergeClaudeUsage({ days: {} }, { '2026-09-20': { 'claude-unknown-9': usage } });
    expect(merged.days['2026-09-20']['claude-unknown-9']).toEqual({ usage, costUsd: null });
  });

  it('overwrites a day found in the transcripts and keeps days no longer found', () => {
    const oldUsage = { ...EMPTY_USAGE, inputTokens: 1_000_000 };
    const store = { days: { '2026-09-18': { 'claude-sonnet-4-5': { usage: oldUsage, costUsd: 3 } }, '2026-09-19': { 'claude-sonnet-4-5': { usage: oldUsage, costUsd: 3 } } } };
    const refreshedUsage = { ...EMPTY_USAGE, inputTokens: 2_000_000 };
    const merged = mergeClaudeUsage(store, { '2026-09-19': { 'claude-sonnet-4-5': refreshedUsage } });
    expect(merged.days['2026-09-18']).toEqual({ 'claude-sonnet-4-5': { usage: oldUsage, costUsd: 3 } });
    expect(merged.days['2026-09-19']).toEqual({ 'claude-sonnet-4-5': { usage: refreshedUsage, costUsd: 6 } });
  });
});

describe('recordClaudeUsage', () => {
  it('persists merged usage atomically and returns it', () => {
    const path = tempPath();
    const usage = { ...EMPTY_USAGE, outputTokens: 1_000_000 };
    const first = recordClaudeUsage(path, { '2026-09-20': { 'claude-haiku-4-5': usage } });
    expect(first).toEqual({ days: { '2026-09-20': { 'claude-haiku-4-5': { usage, costUsd: 5 } } } });
    expect(readClaudeUsageStore(path)).toEqual(first);
  });

  it('keeps a stored day untouched by a later write for a different day', () => {
    const path = tempPath();
    const septUsage = { ...EMPTY_USAGE, outputTokens: 1_000_000 };
    recordClaudeUsage(path, { '2026-09-20': { 'claude-haiku-4-5': septUsage } });
    const octUsage = { ...EMPTY_USAGE, outputTokens: 2_000_000 };
    const second = recordClaudeUsage(path, { '2026-09-21': { 'claude-haiku-4-5': octUsage } });
    expect(second.days['2026-09-20']).toEqual({ 'claude-haiku-4-5': { usage: septUsage, costUsd: 5 } });
    expect(second.days['2026-09-21']).toEqual({ 'claude-haiku-4-5': { usage: octUsage, costUsd: 10 } });
  });
});
