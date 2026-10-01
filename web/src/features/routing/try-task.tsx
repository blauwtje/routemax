import { useId, useState } from 'react';
import { Button } from '@/components/button/button';
import { Select } from '@/components/select/select';
import { TextField } from '@/components/text-field/text-field';
import type { ConfigForm } from '@/hooks/use-config-form';
import type { PlanRequest, RoutePreview as RoutePreviewResult } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';
import { EFFORT_ORDER, TIER_ORDER, type Effort, type Tier } from '../../../../src/config/config-schema';
import styles from './try-task.module.css';

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

const TIER_OPTIONS = TIER_ORDER.map((tier) => ({ value: tier, label: tier, tier }));
const EFFORT_OPTIONS = [{ value: 'none', label: 'none' }, ...EFFORT_ORDER.map((effort) => ({ value: effort, label: effort }))];

// The preview never spends money: wouldCheck only says whether a live task would get the paid check.
function PlanReadout({ plan }: { plan: RoutePreviewResult }) {
  return (
    <dl className={styles.readout}>
      <dt>Goes to</dt>
      <dd className={styles.destination}>{destination(plan)}</dd>
      <dt>Decided by</dt>
      <dd>
        {ROUTED_BY_LABEL[plan.routedBy]}
        {plan.raisedBy !== null ? (
          <span className={styles.muted}>
            {' '}
            · rule <span className="mono">{plan.raisedBy}</span>
          </span>
        ) : null}
      </dd>
      <dt>Why</dt>
      <dd>{plan.routeReason}</dd>
      <dt>Paid check</dt>
      <dd className={plan.wouldCheck ? undefined : styles.muted}>
        {plan.wouldCheck ? 'Would run: the cheapest DeepSeek model checks this unclear task.' : 'Not needed for this task.'}
      </dd>
    </dl>
  );
}

export function TryTask({ form }: { form: ConfigForm }) {
  const [task, setTask] = useState('');
  const [taskType, setTaskType] = useState('');
  const [requestedTier, setRequestedTier] = useState<Tier>('flash-low');
  const [flags, setFlags] = useState('');
  const [claudeEffort, setClaudeEffort] = useState('none');
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });
  const [resultSeq, setResultSeq] = useState(0);
  const tierId = useId();
  const effortId = useId();

  async function preview() {
    const request: PlanRequest = {
      task,
      taskType,
      requestedTier,
      flags: flags.split(',').map((flag) => flag.trim()).filter((flag) => flag !== ''),
    };
    if (claudeEffort !== 'none') request.claudeEffort = claudeEffort as Effort;
    setState({ kind: 'running' });
    try {
      const plan = await api.request<RoutePreviewResult>('POST', '/api/route-preview', { config: form.getValues(), request });
      setState({ kind: 'planned', plan });
    } catch (error) {
      setState({ kind: 'failed', message: describeError(error) });
    }
    setResultSeq((seq) => seq + 1);
  }

  return (
    <div className={styles.box}>
      <div className={styles.fields}>
        <div className={styles.task}>
          <TextField
            label="Task"
            multiline
            rows={3}
            placeholder="Rename the config loader and update its tests"
            value={task}
            onChange={(event) => setTask(event.target.value)}
          />
        </div>
        <TextField label="Task type" value={taskType} onChange={(event) => setTaskType(event.target.value)} />
        <div className={styles.field}>
          <label className={styles.label} htmlFor={tierId}>
            Requested tier
          </label>
          <Select id={tierId} mono options={TIER_OPTIONS} value={requestedTier} onValueChange={(value) => setRequestedTier(value as Tier)} />
        </div>
        <TextField label="Flags" description="Comma-separated" mono value={flags} onChange={(event) => setFlags(event.target.value)} />
        <div className={styles.field}>
          <label className={styles.label} htmlFor={effortId}>
            Effort on Claude
          </label>
          <Select id={effortId} options={EFFORT_OPTIONS} value={claudeEffort} onValueChange={setClaudeEffort} />
        </div>
      </div>
      <div className={styles.output}>
        <Button type="button" variant="primary" loading={state.kind === 'running'} onClick={() => void preview()}>
          Route it
        </Button>
        <div className={styles.result} aria-live="polite">
          {state.kind === 'idle' ? <p className={styles.muted}>No preview yet.</p> : null}
          {state.kind === 'running' ? <p className={styles.muted}>Planning…</p> : null}
          {state.kind === 'planned' ? (
            <div key={resultSeq} className={styles.enter}>
              <PlanReadout plan={state.plan} />
            </div>
          ) : null}
          {state.kind === 'failed' ? (
            <p key={resultSeq} className={`${styles.enter} ${styles.failed}`}>
              {state.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
