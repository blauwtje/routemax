import { describe, expect, it } from 'vitest';
import type { Tier } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { routeTask } from '../src/routing/route-task';

const { rules } = loadConfig(DEFAULT_CONFIG_PATH);
const route = (taskType: string, requestedTier: Tier, task = 'Do the task.', flags: string[] = []) =>
  routeTask(rules, { task, taskType, requestedTier, flags });

describe('routeTask', () => {
  it('keeps search at flash-low without naming a raising rule', () => {
    expect(route('search', 'flash-low')).toEqual({ tier: 'flash-low', raisedBy: null });
  });

  it.each([
    ['boilerplate', 'flash-high', 'boilerplate-tests-edits'],
    ['tests', 'flash-high', 'boilerplate-tests-edits'],
    ['build', 'flash-high', 'build-with-spec'],
    ['security', 'claude', 'claude-only'],
    ['migration', 'claude', 'claude-only'],
  ])('raises %s to %s', (taskType, tier, raisedBy) => {
    expect(route(taskType, 'flash-low')).toEqual({ tier, raisedBy });
  });

  it('raises on a keyword in the task text', () => {
    expect(route('simple-edit', 'flash-low', 'Fix the OAuth callback')).toEqual({ tier: 'claude', raisedBy: 'claude-only' });
  });

  it('keeps a read-only task at its tier when only a keyword matches', () => {
    expect(route('search', 'flash-low', 'Find where the auth token is read')).toEqual({ tier: 'flash-low', raisedBy: null });
    expect(route('summarize', 'flash-low', 'Summarize the migration scripts')).toEqual({ tier: 'flash-low', raisedBy: null });
  });

  it('matches keywords as whole words only', () => {
    expect(route('simple-edit', 'flash-low', 'Rename the author field')).toEqual({ tier: 'flash-high', raisedBy: 'boilerplate-tests-edits' });
  });

  it('raises on a caller flag', () => {
    expect(route('search', 'flash-low', 'Find old rows', ['irreversible'])).toEqual({ tier: 'claude', raisedBy: 'claude-only' });
  });

  it('never goes below the requested tier', () => {
    expect(route('search', 'pro-high')).toEqual({ tier: 'pro-high', raisedBy: null });
    expect(route('unknown-type', 'flash-high')).toEqual({ tier: 'flash-high', raisedBy: null });
  });
});
