import { useCallback, useEffect, useState } from 'react';
import { describeError } from '@/lib/format';

export type PollState<T> =
  | { kind: 'loading' }
  | { kind: 'loaded'; value: T; error: string | null }
  | { kind: 'failed'; message: string };

const POLL_INTERVAL_MS = 30_000;

export function usePoll<T>(load: () => Promise<T>): { state: PollState<T>; refresh: () => void } {
  const [state, setState] = useState<PollState<T>>({ kind: 'loading' });

  const refresh = useCallback(() => {
    load().then(
      (value) => setState({ kind: 'loaded', value, error: null }),
      (error: unknown) =>
        setState((previous) =>
          previous.kind === 'loaded' ? { ...previous, error: describeError(error) } : { kind: 'failed', message: describeError(error) },
        ),
    );
  }, [load]);

  useEffect(() => {
    refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const timer = window.setInterval(refreshWhenVisible, POLL_INTERVAL_MS);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh]);

  return { state, refresh };
}
