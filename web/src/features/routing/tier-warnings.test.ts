import { describe, expect, it } from 'vitest';
import type { ProviderTestResult } from '../../lib/api-types';
import { tierWarnings } from './tier-warnings';

const passed: ProviderTestResult = {
  providerId: 'deepseek',
  model: 'deepseek-flash',
  passed: true,
  costUsd: 0.0004,
  testedAt: '2026-09-25T10:00:00.000Z',
  detail: 'The worker answered and the check passed.',
};
const failed: ProviderTestResult = { ...passed, providerId: 'openrouter', model: 'qwen3-coder', passed: false, costUsd: 0, detail: 'HTTP 401 from the provider: the key was refused.' };

describe('tierWarnings', () => {
  it('warns nothing for tiers on a provider whose last test passed', () => {
    expect(tierWarnings({ 'flash-low': { provider: 'deepseek' }, 'pro-high': { provider: 'deepseek' } }, { deepseek: passed })).toEqual([]);
  });

  it('warns for a tier on a provider that was never tested', () => {
    expect(tierWarnings({ 'flash-low': { provider: 'openrouter' } }, { deepseek: passed })).toEqual([
      'flash-low uses openrouter, which has never been tested. Run a test on the Providers page.',
    ]);
  });

  it('warns with the detail for a tier on a provider whose last test failed', () => {
    expect(tierWarnings({ 'flash-high': { provider: 'openrouter' } }, { deepseek: passed, openrouter: failed })).toEqual([
      'flash-high uses openrouter, whose last test failed: HTTP 401 from the provider: the key was refused.',
    ]);
  });

  it('treats a provider named like an object property as never tested', () => {
    expect(tierWarnings({ 'flash-low': { provider: 'constructor' } }, {})).toEqual([
      'flash-low uses constructor, which has never been tested. Run a test on the Providers page.',
    ]);
  });
});
