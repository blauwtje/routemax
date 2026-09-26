import { useState } from 'react';
import { RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import type { PlanRequest, RoutePlan } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';
import { EFFORT_ORDER, TIER_ORDER, type Effort, type Tier } from '../../../../src/config/config-schema';
import { ListInput } from './list-input';

type PreviewState = { kind: 'idle' } | { kind: 'running' } | { kind: 'planned'; plan: RoutePlan } | { kind: 'failed'; message: string };

const SELECT_CLASS =
  'route-preview-select h-8 w-full rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

// Same colors as the tier dots in tier-editor.tsx; claude takes the accent.
const TIER_DOTS: Record<Tier, string> = {
  'flash-low': 'bg-chart-1',
  'flash-high': 'bg-chart-2',
  'pro-high': 'bg-chart-3',
  claude: 'bg-primary',
};

function describePlan(plan: RoutePlan): string {
  const raised = plan.raisedBy === null ? 'No rule raised it.' : `Raised by rule ${plan.raisedBy}.`;
  if (plan.tier === 'claude') return `claude, agent ${plan.agent}. ${raised}`;
  return `${plan.tier} on ${plan.provider} / ${plan.model} at effort ${plan.effort}. ${raised}`;
}

export function RoutePreview({ form }: { form: ConfigForm }) {
  const [task, setTask] = useState('');
  const [taskType, setTaskType] = useState('');
  const [requestedTier, setRequestedTier] = useState<Tier>('flash-low');
  const [flags, setFlags] = useState<string[]>([]);
  const [claudeEffort, setClaudeEffort] = useState<Effort | ''>('');
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });

  async function preview() {
    const request: PlanRequest = { task, taskType, requestedTier, flags };
    if (claudeEffort !== '') request.claudeEffort = claudeEffort;
    setState({ kind: 'running' });
    try {
      const plan = await api.request<RoutePlan>('POST', '/api/route-preview', { config: form.getValues(), request });
      setState({ kind: 'planned', plan });
    } catch (error) {
      setState({ kind: 'failed', message: describeError(error) });
    }
  }

  return (
    <section aria-labelledby="route-preview-title" className="route-preview flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="route-preview-title" className="font-heading text-lg font-bold tracking-tight">
          Route preview
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">Shows where a task would go with the values on this page, saved or not. It runs no worker.</p>
      </div>
      <div className="route-preview-card flex flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground shadow-(--shadow-card)">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preview-task">Task</Label>
          <Input id="preview-task" value={task} onChange={(event) => setTask(event.target.value)} />
        </div>
        <div className="route-preview-grid grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preview-task-type">Task type</Label>
            <Input id="preview-task-type" value={taskType} onChange={(event) => setTaskType(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preview-tier">Requested tier</Label>
            <select id="preview-tier" className={SELECT_CLASS} value={requestedTier} onChange={(event) => setRequestedTier(event.target.value as Tier)}>
              {TIER_ORDER.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preview-flags">Flags</Label>
            <ListInput id="preview-flags" value={flags} onChange={setFlags} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preview-effort">Effort on Claude</Label>
            <select id="preview-effort" className={SELECT_CLASS} value={claudeEffort} onChange={(event) => setClaudeEffort(event.target.value as Effort | '')}>
              <option value="">none</option>
              {EFFORT_ORDER.map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" className="self-start sm:self-auto" disabled={state.kind === 'running'} onClick={() => void preview()}>
            <RouteIcon aria-hidden="true" data-icon="inline-start" />
            Preview route
          </Button>
          <p className="route-preview-result flex min-w-0 items-center gap-2 text-sm" aria-live="polite">
            {state.kind === 'idle' && <span className="text-muted-foreground">No preview yet.</span>}
            {state.kind === 'running' && <span className="text-muted-foreground">Planning…</span>}
            {state.kind === 'planned' && (
              <>
                <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${TIER_DOTS[state.plan.tier]}`} />
                <span className="min-w-0 break-words tabular-nums">{describePlan(state.plan)}</span>
              </>
            )}
            {state.kind === 'failed' && <span className="min-w-0 break-words whitespace-pre-line text-destructive">{state.message}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}
