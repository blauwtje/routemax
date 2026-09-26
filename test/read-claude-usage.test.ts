import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultProjectsDirs, readClaudeUsage } from '../src/claude-usage/read-claude-usage';

const fixturesDir = fileURLToPath(new URL('./fixtures/claude-projects', import.meta.url));

describe('readClaudeUsage', () => {
  it('dedupes streamed lines by message id and requestId, keeping the largest output, and rolls up by day and model', () => {
    const usage = readClaudeUsage([fixturesDir]);

    expect(usage).toEqual({
      '2026-09-20': {
        'claude-sonnet-4-5': {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 20,
          cacheCreation5mTokens: 30,
          cacheCreation1hTokens: 0,
        },
        'claude-haiku-4-5': {
          inputTokens: 200,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheCreation5mTokens: 0,
          cacheCreation1hTokens: 40,
        },
      },
      '2026-09-21': {
        'claude-sonnet-4-5': {
          inputTokens: 300,
          outputTokens: 30,
          cacheReadTokens: 10,
          cacheCreation5mTokens: 0,
          cacheCreation1hTokens: 0,
        },
      },
    });
  });

  it('never returns message content', () => {
    const usage = readClaudeUsage([fixturesDir]);
    const serialized = JSON.stringify(usage);
    expect(serialized).not.toContain('draft');
    expect(serialized).not.toContain('quick answer');
    expect(serialized).not.toContain('next day work');
  });

  it('skips a directory that does not exist', () => {
    expect(readClaudeUsage([join(fixturesDir, 'missing')])).toEqual({});
  });

  describe('in-memory cache keyed by file path, mtime and size', () => {
    it('reuses a cached parse while mtime and size are unchanged, and reparses once either changes', () => {
      const workDir = mkdtempSync(join(tmpdir(), 'claude-usage-cache-'));
      const filePath = join(workDir, 'session.jsonl');
      const line = (outputTokens: number) =>
        `{"type":"assistant","message":{"id":"msg_c","type":"message","role":"assistant","model":"claude-sonnet-4-5","content":[],"usage":{"input_tokens":10,"output_tokens":${outputTokens},"cache_read_input_tokens":0,"cache_creation_input_tokens":0,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":0}}},"requestId":"req_c","timestamp":"2026-09-22T00:00:00.000Z","session_id":"sess-c","uuid":"uuid-c"}\n`;

      const fixedMtime = new Date('2026-09-22T00:00:00.000Z');
      writeFileSync(filePath, line(10));
      utimesSync(filePath, fixedMtime, fixedMtime);
      const first = readClaudeUsage([workDir]);
      expect(first['2026-09-22']['claude-sonnet-4-5'].outputTokens).toBe(10);

      // Same byte length (single digit swapped for another) and mtime forced back to the cached
      // value: the cache must be reused even though the file's content on disk has changed.
      writeFileSync(filePath, line(20));
      utimesSync(filePath, fixedMtime, fixedMtime);
      const second = readClaudeUsage([workDir]);
      expect(second['2026-09-22']['claude-sonnet-4-5'].outputTokens).toBe(10);

      // Advance mtime: the cache must invalidate and reparse the new content.
      const laterMtime = new Date('2026-09-22T00:00:01.000Z');
      utimesSync(filePath, laterMtime, laterMtime);
      const third = readClaudeUsage([workDir]);
      expect(third['2026-09-22']['claude-sonnet-4-5'].outputTokens).toBe(20);
    });
  });
});

describe('defaultProjectsDirs', () => {
  it('puts CLAUDE_CONFIG_DIR first and dedupes against the home directories', () => {
    const dirs = defaultProjectsDirs('/Users/demo', { CLAUDE_CONFIG_DIR: '/Users/demo/.claude' });
    expect(dirs).toEqual(['/Users/demo/.claude/projects', '/Users/demo/.config/claude/projects']);
  });

  it('falls back to the two home directories when CLAUDE_CONFIG_DIR is unset', () => {
    const dirs = defaultProjectsDirs('/Users/demo', {});
    expect(dirs).toEqual(['/Users/demo/.claude/projects', '/Users/demo/.config/claude/projects']);
  });
});
