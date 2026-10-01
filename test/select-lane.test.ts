import { describe, expect, it } from 'vitest';
import type { DelegateConfig, Effort } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { selectLane } from '../src/routing/select-lane';

const shipped = loadConfig(DEFAULT_CONFIG_PATH);
const peakWindow = { windowsUtc: [[8, 16]] as [number, number][], weekdaysOnly: true, priceFactor: 3 };
const PEAK_TIME = new Date('2026-06-03T10:00:00Z');
const OFF_PEAK_TIME = new Date('2026-06-03T20:00:00Z');

function build(overrides: { preferGlmAtPeak?: boolean; fallback?: boolean; tierEffort?: Effort; taskEfforts?: Record<string, Effort>; efforts?: Effort[] } = {}): DelegateConfig {
  const config = structuredClone(shipped);
  const price = { inputUsd: 1, cacheHitUsd: 0.1, outputUsd: 2 };
  config.providers.deepseek = { ...config.providers.deepseek, peak: peakWindow, models: { ...config.providers.deepseek.models, 'deepseek-flash': price } };
  config.providers.zai = {
    name: 'Z.ai',
    baseUrl: 'https://api.z.ai/api/anthropic',
    models: { 'glm-5.3': price },
    efforts: overrides.efforts ?? ['low', 'high', 'max'],
    enabled: true,
    repairProxy: null,
  };
  config.tiers['flash-low'] = { provider: 'deepseek', model: 'deepseek-flash', effort: overrides.tierEffort ?? 'low' };
  config.lanes = { fallback: overrides.fallback === false ? null : { provider: 'zai', model: 'glm-5.3' }, preferGlmAtPeak: overrides.preferGlmAtPeak ?? false };
  config.taskEfforts = overrides.taskEfforts ?? {};
  return config;
}

describe('selectLane', () => {
  it('uses the tier provider and model off peak', () => {
    expect(selectLane(build({ preferGlmAtPeak: true }), 'flash-low', 'explore', OFF_PEAK_TIME)).toEqual({
      lane: 'deepseek', model: 'deepseek-flash', effort: 'low', taskEffort: 'low', peak: false, priceFactor: 1,
    });
  });

  it('keeps the tier provider at peak unless preferGlmAtPeak is set', () => {
    const selection = selectLane(build(), 'flash-low', 'explore', PEAK_TIME);
    expect(selection).toMatchObject({ lane: 'deepseek', peak: true, priceFactor: 3 });
  });

  it('switches to the fallback lane at peak when preferGlmAtPeak is set', () => {
    expect(selectLane(build({ preferGlmAtPeak: true }), 'flash-low', 'explore', PEAK_TIME)).toEqual({
      lane: 'zai', model: 'glm-5.3', effort: 'low', taskEffort: 'low', peak: true, priceFactor: 1,
    });
  });

  it('stays on the tier provider at peak when no fallback is configured', () => {
    expect(selectLane(build({ preferGlmAtPeak: true, fallback: false }), 'flash-low', 'explore', PEAK_TIME)).toMatchObject({ lane: 'deepseek' });
  });

  it('is off peak on a weekend', () => {
    expect(selectLane(build(), 'flash-low', 'explore', new Date('2026-06-06T10:00:00Z')).peak).toBe(false);
  });

  it.each([
    ['low', 'low'],
    ['medium', 'high'],
    ['high', 'high'],
    ['xhigh', 'high'],
    ['max', 'max'],
  ] as const)('maps tier effort %s to %s', (tierEffort, expected) => {
    expect(selectLane(build({ tierEffort }), 'flash-low', 'explore', OFF_PEAK_TIME).effort).toBe(expected);
  });

  it('prefers the task type effort over the tier effort', () => {
    const config = build({ tierEffort: 'low', taskEfforts: { build: 'xhigh' } });
    expect(selectLane(config, 'flash-low', 'build', OFF_PEAK_TIME).effort).toBe('high');
    expect(selectLane(config, 'flash-low', 'explore', OFF_PEAK_TIME).effort).toBe('low');
  });

  it("fits the effort to the lane's efforts", () => {
    const config = build({ preferGlmAtPeak: true, tierEffort: 'high', efforts: ['low'] });
    expect(selectLane(config, 'flash-low', 'explore', PEAK_TIME).effort).toBe('low');
  });
});
