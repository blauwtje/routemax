import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { resolveEffort } from '../src/routing/resolve-effort';

const { effortMap } = loadConfig(DEFAULT_CONFIG_PATH);

describe('resolveEffort', () => {
  it.each([
    ['low', 'low'],
    ['medium', 'high'],
    ['high', 'high'],
    ['xhigh', 'max'],
    ['max', 'max'],
  ] as const)('maps Claude effort %s to %s on a low tier', (claudeEffort, expected) => {
    expect(resolveEffort(effortMap, 'low', claudeEffort)).toBe(expected);
  });

  it('keeps the tier effort when no Claude effort is given', () => {
    expect(resolveEffort(effortMap, 'high')).toBe('high');
  });

  it('never lowers the tier effort', () => {
    expect(resolveEffort(effortMap, 'high', 'low')).toBe('high');
  });
});
