import { HeartPulseIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DoctorResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { usePoll } from '@/hooks/use-poll';
import { cn } from '@/lib/utils';

const loadDoctor = () => api.request<DoctorResponse>('GET', '/api/doctor');

export function HealthCard() {
  const { state, refresh } = usePoll(loadDoctor);
  const failing = state.kind === 'loaded' ? state.value.checks.filter((check) => !check.ok).length : 0;

  return (
    <Card className="health-card">
      <CardHeader className="gap-x-3 has-data-[slot=card-action]:grid-cols-[auto_1fr_auto]">
        <span
          aria-hidden="true"
          className={cn(
            'row-span-2 grid size-10 place-items-center rounded-lg',
            failing === 0 ? 'bg-primary/15 text-primary' : 'bg-status-refused/15 text-status-refused',
          )}
        >
          <HeartPulseIcon className="size-5" />
        </span>
        <CardTitle role="heading" aria-level={2} className="text-sm font-medium text-muted-foreground">
          Health
        </CardTitle>
        <CardDescription className="text-foreground">
          {state.kind === 'loading' && 'Running the checks…'}
          {state.kind === 'loaded' && failing === 0 && 'All checks pass.'}
          {state.kind === 'loaded' && failing > 0 && (
            <>
              <span className="font-heading text-3xl font-extrabold tracking-tight">{failing}</span>{' '}
              {failing === 1 ? 'check fails' : 'checks fail'}.
            </>
          )}
        </CardDescription>
        <CardAction className="col-start-3 self-center">
          <Button variant="outline" size="sm" onClick={refresh}>
            Run again
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="health-card-body flex flex-col gap-3">
        {state.kind === 'failed' && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {state.kind === 'loaded' && state.error !== null && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {state.kind === 'loaded' && (
          <ul className="health-card-checks grid gap-x-8 gap-y-3 text-sm lg:grid-cols-2">
            {state.value.checks.map((check) => (
              <li key={check.name} className="flex items-start gap-3">
                <Badge
                  variant="secondary"
                  className={cn(
                    'mt-0.5 w-11 shrink-0 justify-center font-medium',
                    check.ok ? 'bg-status-done/15 text-status-done' : 'bg-status-refused/15 text-status-refused',
                  )}
                >
                  {check.ok ? 'ok' : 'fail'}
                </Badge>
                <span className="min-w-0 break-words">
                  <span className="font-medium">{check.name}</span>: <span className="text-muted-foreground">{check.message}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
