import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { SwitchResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';
import { cn } from '@/lib/utils';

type SwitchState =
  | { kind: 'loading' }
  | { kind: 'ready'; enabled: boolean; saving: boolean; error: string | null }
  | { kind: 'failed'; message: string };

export function RouterSwitchCard() {
  const [state, setState] = useState<SwitchState>({ kind: 'loading' });

  useEffect(() => {
    api
      .request<SwitchResponse>('GET', '/api/switch')
      .then(({ enabled }) => setState({ kind: 'ready', enabled, saving: false, error: null }))
      .catch((error: unknown) => setState({ kind: 'failed', message: describeError(error) }));
  }, []);

  async function changeSwitch(enabled: boolean) {
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

  const routerOn = state.kind === 'ready' && state.enabled;

  return (
    <Card
      aria-busy={state.kind === 'loading' || (state.kind === 'ready' && state.saving)}
      className={cn(
        'router-switch-card grid gap-x-8 gap-y-4 rounded-2xl px-6 py-5 text-base ring-0 motion-safe:transition-colors motion-safe:duration-(--dur-feedback) motion-safe:ease-(--ease-out) md:grid-cols-[minmax(0,1fr)_auto] md:items-center',
        routerOn ? 'bg-switch-on text-switch-on-foreground' : 'bg-switch-off text-switch-off-foreground',
      )}
    >
      <CardHeader className="px-0">
        <CardTitle role="heading" aria-level={2} className="font-heading text-3xl leading-tight font-extrabold tracking-tight">Router</CardTitle>
        <CardDescription className="text-base text-current">
          {state.kind === 'ready' && state.enabled && 'On: Claude sessions hand tasks to delegate.'}
          {state.kind === 'ready' && !state.enabled && 'Off: every task stays on Claude.'}
          {state.kind === 'loading' && 'Loading…'}
        </CardDescription>
      </CardHeader>
      <CardContent className="router-switch-body contents">
        {state.kind === 'failed' ? (
          <Alert variant="destructive" className="md:col-span-2">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : (
          <div className="router-switch-row flex items-center gap-4">
            <Switch
              id="router-switch"
              size="lg"
              className="router-switch focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-current data-disabled:cursor-progress"
              checked={routerOn}
              disabled={state.kind !== 'ready' || state.saving}
              onCheckedChange={(checked: boolean) => void changeSwitch(checked)}
              aria-describedby="router-switch-note"
            />
            <Label htmlFor="router-switch" className="text-base font-semibold">
              Route tasks to cheaper models
            </Label>
          </div>
        )}
        {state.kind === 'ready' && state.error !== null && (
          <Alert variant="destructive" className="md:col-span-2">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <p id="router-switch-note" className="router-switch-note border-t border-current/20 pt-4 text-sm md:col-span-2">
          An open Claude session may keep showing delegate until it refreshes its tool list. While the router is off, delegate hands every call back to Claude.
        </p>
      </CardContent>
    </Card>
  );
}
