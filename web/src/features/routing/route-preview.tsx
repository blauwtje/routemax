import { useId, useState } from 'react';
import { RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { SettingsGroup } from '@/components/settings-group';
import type { ConfigForm } from '@/hooks/use-config-form';
import type { PlanRequest, RoutePreview as RoutePreviewResult } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';
import { EFFORT_ORDER, TIER_ORDER, type Effort, type Tier } from '../../../../src/config/config-schema';
import { ListInput } from './list-input';

type PreviewState = { kind: 'idle' } | { kind: 'running' } | { kind: 'planned'; plan: RoutePreviewResult } | { kind: 'failed'; message: string };

const ROUTED_BY_LABEL: Record<RoutePreviewResult['routedBy'], string> = {
  rules: 'Rules',
  score: 'Smart routing score',
  off: 'Rules only, smart routing off',
};

function destination(plan: RoutePreviewResult): string {
  if (plan.tier === 'claude') return `claude, agent ${plan.agent}`;
  return `${plan.tier} on ${plan.model}`;
}

// The preview never spends money: wouldCheck only says whether a live task would get the paid check.
function PlanReadout({ plan }: { plan: RoutePreviewResult }) {
  return (
    <dl className="route-preview-readout grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
      <dt className="font-mono text-xs tracking-wide text-muted-foreground uppercase sm:pt-0.5">Goes to</dt>
      <dd className="font-mono text-foreground">{destination(plan)}</dd>
      <dt className="font-mono text-xs tracking-wide text-muted-foreground uppercase sm:pt-0.5">Decided by</dt>
      <dd>
        {ROUTED_BY_LABEL[plan.routedBy]}
        {plan.raisedBy !== null && (
          <span className="text-muted-foreground">
            {' '}
            · rule <span data-mono>{plan.raisedBy}</span>
          </span>
        )}
      </dd>
      <dt className="font-mono text-xs tracking-wide text-muted-foreground uppercase sm:pt-0.5">Why</dt>
      <dd className="text-pretty">{plan.routeReason}</dd>
      <dt className="font-mono text-xs tracking-wide text-muted-foreground uppercase sm:pt-0.5">Paid check</dt>
      <dd className={plan.wouldCheck ? 'text-primary' : 'text-muted-foreground'}>
        {plan.wouldCheck ? 'Would run: the cheapest DeepSeek model checks this unclear task.' : 'Not needed for this task.'}
      </dd>
    </dl>
  );
}

export function RoutePreview({ form }: { form: ConfigForm }) {
  const [task, setTask] = useState('');
  const [taskType, setTaskType] = useState('');
  const [requestedTier, setRequestedTier] = useState<Tier>('flash-low');
  const [flags, setFlags] = useState<string[]>([]);
  const [claudeEffort, setClaudeEffort] = useState<Effort | ''>('');
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });
  const [resultSeq, setResultSeq] = useState(0);
  const resultHeadingId = useId();

  async function preview() {
    const request: PlanRequest = { task, taskType, requestedTier, flags };
    if (claudeEffort !== '') request.claudeEffort = claudeEffort;
    setState({ kind: 'running' });
    try {
      const plan = await api.request<RoutePreviewResult>('POST', '/api/route-preview', { config: form.getValues(), request });
      setState({ kind: 'planned', plan });
      setResultSeq((seq) => seq + 1);
    } catch (error) {
      setState({ kind: 'failed', message: describeError(error) });
      setResultSeq((seq) => seq + 1);
    }
  }

  return (
    <SettingsGroup
      className="border-t-0 pt-0"
      title="Try a task"
      description="Type a task to see where it would go with the values on this page, saved or not. It runs no worker and spends nothing."
    >
      <div className="route-preview-console flex flex-col gap-4">
        <div className="route-preview-row grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Task" htmlFor="preview-task" className="lg:col-span-2">
            <textarea
              id="preview-task"
              value={task}
              onChange={(event) => setTask(event.target.value)}
              rows={3}
              placeholder="Rename the config loader and update its tests"
              className="min-h-16 w-full resize-y rounded-md border border-border bg-well px-3 py-2 text-sm text-foreground shadow-well outline-none transition-[background-color,border-color,box-shadow] ease-out-expo placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-ring focus-visible:bg-card focus-visible:shadow-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
          <Field label="Task type" htmlFor="preview-task-type">
            <Input value={taskType} onChange={(event) => setTaskType(event.target.value)} />
          </Field>
          <Field label="Requested tier" htmlFor="preview-tier">
            <NativeSelect value={requestedTier} onChange={(event) => setRequestedTier(event.target.value as Tier)}>
              {TIER_ORDER.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Flags" htmlFor="preview-flags" help="Comma-separated">
            <ListInput value={flags} onChange={setFlags} />
          </Field>
          <Field label="Effort on Claude" htmlFor="preview-effort">
            <NativeSelect value={claudeEffort} onChange={(event) => setClaudeEffort(event.target.value as Effort | '')}>
              <option value="">none</option>
              {EFFORT_ORDER.map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="route-preview-output flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-start">
          <Button type="button" variant="outline" className="self-start sm:self-auto" disabled={state.kind === 'running'} onClick={() => void preview()}>
            <RouteIcon aria-hidden="true" data-icon="inline-start" />
            Route it
          </Button>
          <div id={resultHeadingId} className="route-preview-result min-w-0 flex-1 text-sm" aria-live="polite">
            {state.kind === 'idle' && <span className="text-muted-foreground">No preview yet.</span>}
            {state.kind === 'running' && <span className="text-muted-foreground">Planning…</span>}
            {state.kind === 'planned' && (
              <div key={resultSeq} className="route-preview-result-enter break-words">
                <PlanReadout plan={state.plan} />
              </div>
            )}
            {state.kind === 'failed' && (
              <span key={resultSeq} className="route-preview-result-enter break-words whitespace-pre-line text-destructive">
                {state.message}
              </span>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes route-preview-result-in {
          from { opacity: 0.001; transform: translateY(4px); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .route-preview-result-enter {
            display: inline-block;
            animation: route-preview-result-in var(--dur-panel) var(--ease-out-expo) both;
          }
        }
      `}</style>
    </SettingsGroup>
  );
}
