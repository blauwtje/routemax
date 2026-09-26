import { describe, expect, it } from 'vitest';
import { scoreTask } from '../src/routing/score-task';

describe('scoreTask', () => {
  it('scores a clear lookup as flash-low at low effort, confidently', () => {
    const result = scoreTask('Find where the auth token is read', 'search');
    expect(result.tier).toBe('flash-low');
    expect(result.effort).toBe('low');
    expect(result.confident).toBe(true);
  });

  it('scores a clearly hard build as pro-high at high effort, confidently', () => {
    const task = 'Build a fix for the race condition in the queue.';
    const result = scoreTask(task, 'build');
    expect(result.tier).toBe('pro-high');
    expect(result.effort).toBe('high');
    expect(result.confident).toBe(true);
  });

  it('is not confident on a short, ambiguous task with no strong signal', () => {
    const result = scoreTask('Look at this', 'unknown-type');
    expect(result.confident).toBe(false);
  });

  it('records the signals it matched', () => {
    const result = scoreTask('Summarize the migration scripts', 'summarize');
    expect(result.signals).toContain('low-task-type:summarize');
    expect(result.signals).toContain('low-verb:summarize');
  });

  it('raises the tier on named files and code presence', () => {
    const withCode = scoreTask('Update the retry logic in `worker.ts` using a ```ts\\nconst x = 1\\n``` snippet', 'simple-edit');
    const withoutCode = scoreTask('Update the retry logic', 'simple-edit');
    expect(withCode.signals).toContain('code-present');
    expect(withCode.signals.some((signal) => signal.startsWith('named-files'))).toBe(true);
    expect(withoutCode.signals).not.toContain('code-present');
  });
});
