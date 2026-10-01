import type { ApiClient } from './api-client';
import { ApiError } from './api-client';
import type { DelegateConfig, SaveResponse } from './api-types';
import { describeError } from './format';

export const AUTOSAVE_DELAY_MS = 600;

export type AutosaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; chezmoiMessage: string }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'stale' }
  | { kind: 'failed'; message: string };

function failureState(error: unknown): AutosaveState {
  if (error instanceof ApiError && error.status === 409) return { kind: 'stale' };
  if (error instanceof ApiError && error.status === 422) return { kind: 'invalid', issues: error.issues };
  return { kind: 'failed', message: describeError(error) };
}

/**
 * Collects config changes and saves the latest one 600 ms after the last change, with one request
 * in flight at a time. `baseHash` is the hash of the config the page loaded; each save or restore
 * moves it forward. A stale or invalid save leaves the hash alone: the page reloads to recover.
 */
export function createAutosaveQueue(api: ApiClient, baseHash: string) {
  let hash = baseHash;
  let pending: DelegateConfig | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let current: AutosaveState = { kind: 'idle' };
  const listeners = new Set<(state: AutosaveState) => void>();

  function setState(next: AutosaveState) {
    current = next;
    for (const listener of listeners) listener(next);
  }

  function cancelTimer() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  async function send(method: 'PUT' | 'POST', path: string, body: unknown) {
    setState({ kind: 'saving' });
    try {
      const response = await api.request<SaveResponse>(method, path, body);
      hash = response.hash;
      setState({ kind: 'saved', chezmoiMessage: response.chezmoi.message });
    } catch (error) {
      setState(failureState(error));
    }
  }

  function flush() {
    timer = null;
    if (inFlight !== null || pending === null) return;
    const config = pending;
    pending = null;
    inFlight = send('PUT', '/api/config', { config, baseHash: hash }).then(() => {
      inFlight = null;
      // A null timer with a change waiting means its 600 ms passed during the flight.
      if (pending !== null && timer === null) flush();
    });
  }

  return {
    state: () => current,
    subscribe(listener: (state: AutosaveState) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    change(config: DelegateConfig) {
      pending = config;
      cancelTimer();
      timer = setTimeout(flush, AUTOSAVE_DELAY_MS);
    },
    /** Drops unsaved changes, lets a request in flight finish, then restores the previous version. */
    async undo() {
      cancelTimer();
      pending = null;
      await inFlight;
      inFlight = send('POST', '/api/config/restore', { baseHash: hash }).then(() => {
        inFlight = null;
      });
      await inFlight;
    },
  };
}

export type AutosaveQueue = ReturnType<typeof createAutosaveQueue>;
