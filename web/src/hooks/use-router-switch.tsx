import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SwitchResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';

export type RouterSwitchState =
  | { kind: 'loading' }
  | { kind: 'ready'; enabled: boolean; saving: boolean; error: string | null }
  | { kind: 'failed'; message: string };

interface RouterSwitchContextValue {
  state: RouterSwitchState;
  setEnabled: (enabled: boolean) => Promise<void>;
}

const RouterSwitchContext = createContext<RouterSwitchContextValue | null>(null);

export function RouterSwitchProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RouterSwitchState>({ kind: 'loading' });

  useEffect(() => {
    api
      .request<SwitchResponse>('GET', '/api/switch')
      .then(({ enabled }) => setState({ kind: 'ready', enabled, saving: false, error: null }))
      .catch((error: unknown) => setState({ kind: 'failed', message: describeError(error) }));
  }, []);

  async function setEnabled(enabled: boolean) {
    if (state.kind !== 'ready') return;
    const previous = state.enabled;
    setState({ kind: 'ready', enabled, saving: true, error: null });
    try {
      const response = await api.request<SwitchResponse>('PUT', '/api/switch', { enabled });
      setState({ kind: 'ready', enabled: response.enabled, saving: false, error: null });
    } catch (error) {
      setState({ kind: 'ready', enabled: previous, saving: false, error: describeError(error) });
    }
  }

  return <RouterSwitchContext.Provider value={{ state, setEnabled }}>{children}</RouterSwitchContext.Provider>;
}

export function useRouterSwitch(): RouterSwitchContextValue {
  const context = useContext(RouterSwitchContext);
  if (context === null) throw new Error('useRouterSwitch must be used within RouterSwitchProvider');
  return context;
}
