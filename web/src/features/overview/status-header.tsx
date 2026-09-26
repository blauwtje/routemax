import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRouterSwitch } from '@/hooks/use-router-switch';
import type { PeriodStats, StatsResponse } from '@/lib/api-types';
import { OverviewFigures, type Period } from './overview-figures';

interface StatusHeaderProps {
  budget?: StatsResponse['budget'];
  stats?: PeriodStats;
  period: Period;
  onPeriodChange: (period: Period) => void;
}

/**
 * The showpiece hero band: an Instrument Serif sentence stating where tasks go, the router
 * switch, and the budget line + segmented bar, over the ground's router-hue glow, repeated
 * inside this panel (contract: routing-flow-hero / router-state-everywhere).
 */
export function StatusHeader({ budget, stats, period, onPeriodChange }: StatusHeaderProps) {
  const { state, setEnabled } = useRouterSwitch();
  const routerOn = state.kind === 'ready' && state.enabled;

  return (
    <div className="overview-hero relative flex flex-col gap-6 overflow-hidden rounded-lg border border-border bg-surface-1 p-6 shadow-panel before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[oklch(1_0_0/0.08)] sm:p-8">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 80% ellipse at 10% 0%, color-mix(in oklch, var(--router-glow) 16%, transparent), transparent 70%)',
          transition: 'background var(--dur-router-glow) var(--ease-out-expo)',
        }}
      />
      <div className="relative flex flex-col gap-6">
        {state.kind === 'failed' ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : (
          <div
            className="overview-lead-row flex flex-wrap items-center justify-between gap-6"
            aria-busy={state.kind === 'loading' || (state.kind === 'ready' && state.saving)}
          >
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.08em]">Router</p>
              <Label
                htmlFor="overview-router-switch"
                className="font-display text-[36px] leading-[1.1] text-foreground sm:text-[56px]"
              >
                {state.kind === 'loading' && 'Loading…'}
                {state.kind === 'ready' && state.enabled && 'Routing to workers.'}
                {state.kind === 'ready' && !state.enabled && 'Everything stays on Claude.'}
              </Label>
              <p id="overview-router-note" className="max-w-[60ch] text-sm text-pretty text-muted-foreground">
                An open Claude session may keep showing delegate until it refreshes its tool list.
                {!routerOn && ' While the router is off, delegate hands every call back to Claude.'}
              </p>
            </div>
            <Switch
              id="overview-router-switch"
              size="lg"
              checked={routerOn}
              disabled={state.kind !== 'ready' || state.saving}
              onCheckedChange={(checked: boolean) => void setEnabled(checked)}
              aria-describedby="overview-router-note"
            />
          </div>
        )}
        {state.kind === 'ready' && state.error !== null && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {budget && stats && <OverviewFigures budget={budget} stats={stats} period={period} onPeriodChange={onPeriodChange} />}
      </div>
    </div>
  );
}
