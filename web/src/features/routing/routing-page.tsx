import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Button } from '@/components/button/button';
import { Badge, StatusDot, type Tone } from '@/components/badge/badge';
import { List, ListRow } from '@/components/list/list';
import { Switch } from '@/components/switch/switch';
import { TextField } from '@/components/text-field/text-field';
import { toast } from '@/components/toast/toast';
import { useConfigForm, type SaveState } from '@/hooks/use-config-form';
import { usePoll } from '@/hooks/use-poll';
import type { ProviderTestsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { ProviderSection } from './provider-section';
import { RulesSection } from './rules-section';
import { TierDialog, WORKER_TIERS, type WorkerTierName } from './tier-dialog';
import { tierWarnings } from './tier-warnings';
import { TryTask } from './try-task';
import styles from './routing-page.module.css';

const loadProviderTests = () => api.request<ProviderTestsResponse>('GET', '/api/provider-tests');

const SAVE_STATUS: Record<SaveState['kind'], { tone: Tone; text: string }> = {
  idle: { tone: 'neutral', text: 'Changes save as you make them' },
  saving: { tone: 'busy', text: 'Saving…' },
  saved: { tone: 'ok', text: 'All changes saved' },
  invalid: { tone: 'warn', text: 'Not saved: fix the marked fields' },
  stale: { tone: 'warn', text: 'Not saved: config changed elsewhere' },
  failed: { tone: 'danger', text: 'Not saved' },
};

/** Zod reports an emptied number box as NaN in its own words; say what to do instead. */
function fieldMessage(error: { message?: string } | undefined): string | undefined {
  if (error === undefined) return undefined;
  const message = error.message ?? '';
  if (message === '' || /NaN|expected number/i.test(message)) return 'Enter a number.';
  return message;
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <header className={styles.groupHead}>
        <h2 id={headingId} className={styles.groupTitle}>
          {title}
        </h2>
        <p className={styles.groupNote}>{description}</p>
      </header>
      <div className={styles.groupBody}>{children}</div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className={styles.page} aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading routing
      </p>
      <div className={styles.head}>
        <h1 className={styles.title}>Routing</h1>
      </div>
      {[13, 9, 14, 12, 15].map((height) => (
        <div key={height} className={styles.group} aria-hidden="true">
          <div className={styles.groupHead}>
            <span className={styles.skeletonLine} style={{ inlineSize: '7rem' }} />
            <span className={styles.skeletonLine} style={{ inlineSize: '12rem', blockSize: '0.75rem' }} />
          </div>
          <div className={styles.groupBody}>
            <span className={styles.skeletonBlock} style={{ blockSize: `${height}rem` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoutingPage() {
  const { form, ready, loadError, saveState, undo, reload } = useConfigForm();
  const { state: testsState } = usePoll(loadProviderTests);
  const [dialog, setDialog] = useState<{ tier: WorkerTierName; open: boolean }>({ tier: WORKER_TIERS[0], open: false });
  const providers = useWatch({ control: form.control, name: 'providers' });
  const tiers = useWatch({ control: form.control, name: 'tiers' });
  const smartEnabled = useWatch({ control: form.control, name: 'smartRouting.enabled' });
  const errors = form.formState.errors;

  // The toast callbacks live in refs so a toast is raised once per save state, not once per render.
  const actions = useRef({ undo, reload });
  actions.current = { undo, reload };
  const undoing = useRef(false);
  const handled = useRef<SaveState | null>(null);

  useEffect(() => {
    if (handled.current === saveState) return;
    handled.current = saveState;
    if (saveState.kind === 'saving') return;
    const wasUndo = undoing.current;
    undoing.current = false;
    if (saveState.kind === 'saved') {
      if (wasUndo) {
        toast.saved('Change undone.');
        return;
      }
      toast.saved(saveState.chezmoiMessage || undefined, () => {
        undoing.current = true;
        void actions.current.undo();
      });
    } else if (saveState.kind === 'stale') {
      toast.stale(() => actions.current.reload());
    } else if (saveState.kind === 'failed') {
      toast.failed('Could not save', saveState.message);
    }
  }, [saveState]);

  if (loadError !== null) {
    return (
      <div className={styles.page}>
        <div className={styles.head}>
          <h1 className={styles.title}>Routing</h1>
        </div>
        <div className={styles.problem} role="alert">
          <StatusDot tone="danger" />
          <div className={styles.problemText}>
            <h2 className={styles.problemTitle}>Routing could not be loaded</h2>
            <p className={styles.problemDetail}>{loadError}</p>
          </div>
          <Button type="button" variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!ready) return <LoadingState />;

  const status = SAVE_STATUS[saveState.kind];
  const tests = testsState.kind === 'loaded' ? testsState.value : null;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Routing</h1>
          <p className={styles.lede}>Where tasks go, which rules steer them, and a way to check before you spend.</p>
        </div>
        <p className={styles.status} data-state={saveState.kind}>
          <StatusDot tone={status.tone} />
          <span>{status.text}</span>
        </p>
      </div>

      {saveState.kind === 'invalid' && saveState.issues.length > 0 && Object.keys(errors).length === 0 ? (
        <div className={styles.issues} role="alert">
          <StatusDot tone="warn" />
          <ul>
            {saveState.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Section title="Tiers" description="Where each tier sends a task. Tasks that end on Claude use the Claude agents below.">
        <List aria-label="Tiers">
          {WORKER_TIERS.map((tierName) => {
            const tier = tiers?.[tierName];
            const providerName = tier !== undefined && providers !== undefined && Object.hasOwn(providers, tier.provider) ? providers[tier.provider].name : tier?.provider;
            const warnings = tier !== undefined && tests !== null ? tierWarnings({ [tierName]: tier }, tests) : [];
            const untested = warnings.length > 0 && warnings[0].includes('never been tested');
            return (
              <ListRow
                key={tierName}
                title={
                  <span className={styles.tierName}>
                    <Badge tier={tierName}>{tierName}</Badge>
                  </span>
                }
                subtitle={tier ? `${providerName} · ${tier.model} · ${tier.effort}` : undefined}
                status={warnings.length > 0 ? <Badge tone="warn">{untested ? 'Untested' : 'Test failed'}</Badge> : undefined}
                invalid={warnings.length > 0 && !untested}
                openLabel={`Edit tier ${tierName}`}
                onOpen={() => setDialog({ tier: tierName, open: true })}
              />
            );
          })}
        </List>
        {WORKER_TIERS.flatMap((tierName) => {
          const tier = tiers?.[tierName];
          if (tier === undefined || tests === null) return [];
          return tierWarnings({ [tierName]: tier }, tests).map((warning) => (
            <p key={warning} className={styles.warning}>
              <StatusDot tone="warn" />
              <span>{warning}</span>
            </p>
          ));
        })}
      </Section>

      <Section title="Smart routing" description="Score unclear tasks instead of falling straight to the rules. An unclear task can get one cheap paid check.">
        <Controller
          control={form.control}
          name="smartRouting.enabled"
          render={({ field }) => (
            <div className={styles.toggleRow}>
              <div>
                <p className={styles.toggleTitle}>Smart routing</p>
                <p className={styles.toggleNote}>Off means rules alone decide where a task goes.</p>
              </div>
              <Switch size="sm" aria-label="Smart routing" stateText={{ on: 'On', off: 'Off' }} checked={field.value ?? true} onCheckedChange={field.onChange} />
            </div>
          )}
        />
        <TextField
          label="Check timeout"
          description="The paid check gives up after this long and the score decides."
          type="number"
          step="1"
          min={0}
          placeholder="3000"
          suffix="ms"
          disabled={smartEnabled === false}
          error={fieldMessage(errors.smartRouting?.checkTimeoutMs)}
          {...form.register('smartRouting.checkTimeoutMs', { valueAsNumber: true })}
        />
      </Section>

      <Section title="Providers" description="Who can run work, with the models and prices each offers.">
        <ProviderSection form={form} />
      </Section>

      <Section title="Rules and agents" description="Rules raise a task to a tier. Agents and effort decide what runs on Claude.">
        <RulesSection form={form} />
      </Section>

      <Section title="Try a task" description="See where a task would go with the values on this page, saved or not. It runs no worker and spends nothing.">
        <TryTask form={form} />
      </Section>

      <TierDialog
        form={form}
        tier={dialog.tier}
        tests={tests}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />
    </div>
  );
}
