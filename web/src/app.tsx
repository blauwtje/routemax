import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { api } from '@/lib/browser-api';

type SwitchState = { kind: 'loading' } | { kind: 'loaded'; enabled: boolean } | { kind: 'failed'; message: string };

export function App() {
  const [switchState, setSwitchState] = useState<SwitchState>({ kind: 'loading' });

  useEffect(() => {
    api
      .request<{ enabled: boolean }>('GET', '/api/switch')
      .then(({ enabled }) => setSwitchState({ kind: 'loaded', enabled }))
      .catch((error: unknown) =>
        setSwitchState({ kind: 'failed', message: error instanceof ApiError ? error.message : 'The server did not answer.' }),
      );
  }, []);

  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold">routemax</h1>
      <p>
        {switchState.kind === 'loading' && 'Loading…'}
        {switchState.kind === 'loaded' && `Router: ${switchState.enabled ? 'on' : 'off'}`}
        {switchState.kind === 'failed' && switchState.message}
      </p>
    </main>
  );
}
