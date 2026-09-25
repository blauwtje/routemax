import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appendDecision, decisionLogPath, readSpentUsd, type DecisionRecord } from '../src/decision-log/decision-log';

const record = (costUsd: number): DecisionRecord => ({
  ts: '2026-09-25T10:00:00.000Z',
  cwd: '/work',
  taskType: 'search',
  requestedTier: 'flash-low',
  finalTier: 'flash-low',
  raisedBy: null,
  model: 'deepseek-v4-flash',
  effort: 'low',
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd,
  status: 'done',
  reason: null,
  durationMs: 1200,
  retries: 0,
});
const tempLog = () => join(mkdtempSync(join(tmpdir(), 'routemax-log-')), 'state', 'decisions.jsonl');

describe('decision log', () => {
  it('lives under ~/.local/state/deepseek-delegate', () => {
    expect(decisionLogPath('/home/me')).toBe('/home/me/.local/state/deepseek-delegate/decisions.jsonl');
  });

  it('reads spent-to-date as the sum of costUsd over every logged call', async () => {
    const logPath = tempLog();
    await appendDecision(logPath, record(0.12));
    await appendDecision(logPath, record(0.3));
    expect(await readSpentUsd(logPath)).toBeCloseTo(0.42, 10);
  });

  it('reads zero before the first call', async () => {
    expect(await readSpentUsd(tempLog())).toBe(0);
  });

  it('fails closed on a corrupt line', async () => {
    const logPath = tempLog();
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(logPath, '{"costUsd":0.1}\nnot json\n');
    await expect(readSpentUsd(logPath)).rejects.toThrow();
  });
});
