import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countProxyRetries } from '../src/proxy/count-proxy-retries';

describe('countProxyRetries', () => {
  it('sums retries inside the window and skips a partial last line', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'routemax-telemetry-')), 'telemetry.jsonl');
    const lines = [
      { ts: '2026-09-25T10:00:00.000Z', retries: [{ reason: 'empty' }] },
      { ts: '2026-09-25T10:01:00.000Z', retries: [{ reason: 'empty' }, { reason: 'text-tool-call' }] },
      { ts: '2026-09-25T10:02:00.000Z', retries: [] },
      { ts: '2026-09-25T10:05:00.000Z', retries: [{ reason: 'empty' }] },
    ];
    writeFileSync(path, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n{"ts":"2026-09-25T10:01:30`);
    expect(await countProxyRetries(path, new Date('2026-09-25T10:00:30.000Z'), new Date('2026-09-25T10:03:00.000Z'))).toBe(2);
  });

  it('counts zero when the proxy has no telemetry file', async () => {
    expect(await countProxyRetries('/nonexistent/telemetry.jsonl', new Date(0), new Date())).toBe(0);
  });
});
