import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from './api-client';
import { createAutosaveQueue, type AutosaveState } from './autosave-queue';
import type { DelegateConfig } from './api-types';

interface Call { method: string; path: string; body: unknown }

const configOf = (name: string) => ({ name }) as unknown as DelegateConfig;
const saved = (hash: string) => ({ hash, chezmoi: { state: 'synced', message: `synced ${hash}` } });

function fakeApi(respond: (call: Call, index: number) => Promise<unknown>) {
  const calls: Call[] = [];
  const api = {
    request: (method: string, path: string, body?: unknown) => {
      const call = { method, path, body };
      calls.push(call);
      return respond(call, calls.length - 1);
    },
  } as unknown as ApiClient;
  return { api, calls };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createAutosaveQueue', () => {
  it('starts idle and sends nothing before the delay passes', async () => {
    const { api, calls } = fakeApi(async () => saved('h1'));
    const queue = createAutosaveQueue(api, 'h0');
    queue.change(configOf('a'));
    await vi.advanceTimersByTimeAsync(599);
    expect(calls).toHaveLength(0);
    expect(queue.state()).toEqual({ kind: 'idle' });
  });

  it('saves 600 ms after the last change with only the latest config and the base hash', async () => {
    const { api, calls } = fakeApi(async () => saved('h1'));
    const queue = createAutosaveQueue(api, 'h0');
    queue.change(configOf('a'));
    await vi.advanceTimersByTimeAsync(400);
    queue.change(configOf('b'));
    await vi.advanceTimersByTimeAsync(599);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toEqual([{ method: 'PUT', path: '/api/config', body: { config: configOf('b'), baseHash: 'h0' } }]);
    expect(queue.state()).toEqual({ kind: 'saved', chezmoiMessage: 'synced h1' });
  });

  it('reports saving while a request is in flight and uses the new hash for the next save', async () => {
    const releases: Array<() => void> = [];
    const { api, calls } = fakeApi(
      (_call, index) => new Promise((resolve) => releases.push(() => resolve(saved(`h${index + 1}`)))),
    );
    const queue = createAutosaveQueue(api, 'h0');
    const states: AutosaveState['kind'][] = [];
    queue.subscribe((state) => states.push(state.kind));
    queue.change(configOf('a'));
    await vi.advanceTimersByTimeAsync(600);
    expect(queue.state()).toEqual({ kind: 'saving' });

    queue.change(configOf('b'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);

    releases[0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toEqual({ config: configOf('b'), baseHash: 'h1' });
    releases[1]();
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.state()).toEqual({ kind: 'saved', chezmoiMessage: 'synced h2' });
    expect(states).toContain('saving');
  });

  it('waits the full delay after a change made during a flight that ended earlier', async () => {
    let release = () => {};
    const { api, calls } = fakeApi(() => new Promise((resolve) => (release = () => resolve(saved('h1')))));
    const queue = createAutosaveQueue(api, 'h0');
    queue.change(configOf('a'));
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(100);
    queue.change(configOf('b'));
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(2);
  });

  it('reports invalid with the server issues on a 422', async () => {
    const { api } = fakeApi(async () => {
      throw new ApiError(422, 'invalid', ['tiers.fast: no model']);
    });
    const queue = createAutosaveQueue(api, 'h0');
    queue.change(configOf('a'));
    await vi.advanceTimersByTimeAsync(600);
    expect(queue.state()).toEqual({ kind: 'invalid', issues: ['tiers.fast: no model'] });
  });

  it('reports stale on a 409', async () => {
    const { api } = fakeApi(async () => {
      throw new ApiError(409, 'stale', []);
    });
    const queue = createAutosaveQueue(api, 'h0');
    queue.change(configOf('a'));
    await vi.advanceTimersByTimeAsync(600);
    expect(queue.state()).toEqual({ kind: 'stale' });
  });

  it('reports failed with a message on any other error and retries on the next change', async () => {
    let attempts = 0;
    const { api, calls } = fakeApi(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return saved('h1');
    });
    const queue = createAutosaveQueue(api, 'h0');
    queue.change(configOf('a'));
    await vi.advanceTimersByTimeAsync(600);
    expect(queue.state()).toMatchObject({ kind: 'failed' });
    queue.change(configOf('b'));
    await vi.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(2);
    expect(queue.state()).toEqual({ kind: 'saved', chezmoiMessage: 'synced h1' });
  });

  it('undo posts the restore with the current hash, drops pending changes and adopts the restored hash', async () => {
    const { api, calls } = fakeApi(async (call) => (call.path === '/api/config/restore' ? saved('h2') : saved('h1')));
    const queue = createAutosaveQueue(api, 'h0');
    queue.change(configOf('a'));
    await vi.advanceTimersByTimeAsync(600);
    queue.change(configOf('b'));
    await queue.undo();
    expect(calls[1]).toEqual({ method: 'POST', path: '/api/config/restore', body: { baseHash: 'h1' } });
    expect(queue.state()).toEqual({ kind: 'saved', chezmoiMessage: 'synced h2' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toHaveLength(2);
    queue.change(configOf('c'));
    await vi.advanceTimersByTimeAsync(600);
    expect(calls[2].body).toEqual({ config: configOf('c'), baseHash: 'h2' });
  });

  it('undo waits for a request in flight and then restores from its hash', async () => {
    let release = () => {};
    const { api, calls } = fakeApi((call) =>
      call.method === 'PUT' ? new Promise((resolve) => (release = () => resolve(saved('h1')))) : Promise.resolve(saved('h2')),
    );
    const queue = createAutosaveQueue(api, 'h0');
    queue.change(configOf('a'));
    await vi.advanceTimersByTimeAsync(600);
    const undone = queue.undo();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    release();
    await undone;
    expect(calls[1].body).toEqual({ baseHash: 'h1' });
  });

  it('undo reports a failed restore through the same states', async () => {
    const { api } = fakeApi(async () => {
      throw new ApiError(404, 'missing', ['There is no previous version to restore.']);
    });
    const queue = createAutosaveQueue(api, 'h0');
    await queue.undo();
    expect(queue.state()).toMatchObject({ kind: 'failed', message: 'There is no previous version to restore.' });
  });
});
