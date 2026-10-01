import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/button/button';
import { StatusDot, type Tone } from '@/components/badge/badge';
import { Switch } from '@/components/switch/switch';
import { TextField } from '@/components/text-field/text-field';
import { toast } from '@/components/toast/toast';
import { useConfigForm, type SaveState } from '@/hooks/use-config-form';
import { usePoll } from '@/hooks/use-poll';
import type { StatsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { formatUsd } from '@/lib/format';
import styles from './settings-page.module.css';

const loadStats = () => api.request<StatsResponse>('GET', '/api/stats');

const RETRY_HELP =
  'How many failed delegate retries to allow before a task escalates to Claude. When off, retries have no limit.';

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

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // Clipboard access can be refused; the button then simply does nothing.
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      iconOnly
      icon={copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      disabled={value === ''}
      onClick={() => void copy()}
    />
  );
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

function SpendReadout({ budget }: { budget: StatsResponse['budget'] | null | 'failed' }) {
  if (budget === null) {
    return (
      <div className={styles.spend} data-state="loading" aria-hidden="true">
        <span className={styles.skeletonFigure} />
        <span className={styles.bar} />
      </div>
    );
  }
  if (budget === 'failed') {
    return (
      <div className={styles.spend} data-state="failed">
        <p className={styles.spendNote}>Current spend is unavailable right now. The limits below still apply.</p>
      </div>
    );
  }
  const ratio = budget.totalUsd > 0 ? Math.min(1, budget.spentUsd / budget.totalUsd) : 0;
  const level = budget.totalUsd > 0 && budget.spentUsd >= budget.totalUsd ? 'over' : ratio >= 0.8 ? 'near' : 'ok';
  return (
    <div className={styles.spend} data-state="loaded">
      <div className={styles.spendFigures}>
        <p className={styles.spendTotal}>
          <span className={styles.figure}>{formatUsd(budget.spentUsd)}</span>
          <span className={styles.spendOf}>
            spent of <span className="mono">{formatUsd(budget.totalUsd)}</span>
          </span>
        </p>
        <p className={styles.spendLeft}>
          <span className="mono">{formatUsd(budget.leftUsd)}</span> left
        </p>
      </div>
      <div
        className={styles.bar}
        role="meter"
        aria-label="Budget spent"
        aria-valuemin={0}
        aria-valuemax={budget.totalUsd}
        aria-valuenow={Math.min(budget.spentUsd, budget.totalUsd)}
        aria-valuetext={`${formatUsd(budget.spentUsd)} of ${formatUsd(budget.totalUsd)}, ${formatUsd(budget.leftUsd)} left`}
        data-level={level}
        style={{ '--spent': `${(ratio * 100).toFixed(2)}%` } as CSSProperties}
      >
        <span className={styles.barFill} />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className={styles.page} aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading settings
      </p>
      <div className={styles.head}>
        <h1 className={styles.title}>Settings</h1>
      </div>
      {[16, 13, 11, 12].map((height) => (
        <div key={height} className={styles.group} aria-hidden="true" data-skeleton>
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

export function SettingsPage() {
  const { form, ready, loadError, saveState, undo, reload } = useConfigForm();
  const { state: statsState } = usePoll(loadStats);
  const [newFolder, setNewFolder] = useState('');
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
          <h1 className={styles.title}>Settings</h1>
        </div>
        <div className={styles.problem} role="alert">
          <StatusDot tone="danger" />
          <div className={styles.problemText}>
            <h2 className={styles.problemTitle}>Settings could not be loaded</h2>
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

  const budget = statsState.kind === 'loaded' ? statsState.value.budget : statsState.kind === 'failed' ? 'failed' : null;
  const status = SAVE_STATUS[saveState.kind];
  const fieldErrorCount = Object.keys(errors).length;
  const projectErrors = errors.projects as Record<string, { testCommand?: { message?: string } }> | undefined;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.lede}>Budget, timeouts and commands for delegated work.</p>
        </div>
        <p className={styles.status} data-state={saveState.kind}>
          <StatusDot tone={status.tone} />
          <span>{status.text}</span>
        </p>
      </div>

      {saveState.kind === 'invalid' && fieldErrorCount === 0 && saveState.issues.length > 0 ? (
        <div className={styles.issues} role="alert">
          <StatusDot tone="warn" />
          <ul>
            {saveState.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Section
        title="Budget"
        description="What delegated DeepSeek work may cost. Claude's own use does not count against it."
      >
        <SpendReadout budget={budget} />
        <div className={styles.fields}>
          <TextField
            label="Total budget"
            description="Stops every delegate call once the period's spend reaches this amount."
            type="number"
            step="0.01"
            min={0}
            prefix="$"
            error={fieldMessage(errors.budget?.totalUsd)}
            {...form.register('budget.totalUsd', { valueAsNumber: true })}
          />
          <TextField
            label="Budget per call"
            description="Rejects a single delegate call priced above this amount."
            type="number"
            step="0.01"
            min={0}
            prefix="$"
            error={fieldMessage(errors.budget?.perCallUsd)}
            {...form.register('budget.perCallUsd', { valueAsNumber: true })}
          />
        </div>
      </Section>

      <Section
        title="Timeouts and retries"
        description="How long a delegate or test call may run, and how often a failed one is tried again."
      >
        <div className={styles.fields}>
          <TextField
            label="Worker timeout"
            description="A delegate call taking longer than this is treated as failed."
            type="number"
            step="1"
            min={0}
            suffix="ms"
            error={fieldMessage(errors.workerTimeoutMs)}
            {...form.register('workerTimeoutMs', { valueAsNumber: true })}
          />
          <TextField
            label="Test timeout"
            description="A provider test call taking longer than this is treated as failed."
            type="number"
            step="1"
            min={0}
            suffix="ms"
            error={fieldMessage(errors.testTimeoutMs)}
            {...form.register('testTimeoutMs', { valueAsNumber: true })}
          />
          <Controller
            control={form.control}
            name="retryThreshold"
            render={({ field }) => {
              const enabled = field.value !== null && field.value !== undefined;
              const shown = enabled && !Number.isNaN(field.value) ? (field.value ?? '') : '';
              return (
                <div className={styles.retry} data-enabled={enabled || undefined}>
                  <TextField
                    label="Retry threshold"
                    description={RETRY_HELP}
                    type="number"
                    step="1"
                    min={0}
                    placeholder="Off"
                    disabled={!enabled}
                    value={shown}
                    error={fieldMessage(errors.retryThreshold)}
                    name={field.name}
                    onBlur={field.onBlur}
                    // An emptied box stays on as NaN so the box keeps focus; the field then reports "Enter a number".
                    onChange={(event) => field.onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))}
                  />
                  <Switch
                    size="sm"
                    label="Limit retries"
                    stateText={{ on: 'On', off: 'Off' }}
                    checked={enabled}
                    onCheckedChange={(checked) => field.onChange(checked ? 1 : null)}
                  />
                </div>
              );
            }}
          />
        </div>
      </Section>

      <Section title="Claude and proxy" description="Which binary starts Claude, where the repair proxy runs, and how Explore calls travel.">
        <div className={styles.fields} data-columns="one">
          <TextField
            label="Claude command"
            description="The binary routemax runs to launch a Claude session."
            mono
            autoComplete="off"
            spellCheck={false}
            error={fieldMessage(errors.claudeBin)}
            adornment={<CopyButton value={form.watch('claudeBin') ?? ''} label="Claude command" />}
            {...form.register('claudeBin')}
          />
          <TextField
            label="Proxy folder"
            description="The repair proxy's working directory."
            mono
            autoComplete="off"
            spellCheck={false}
            error={fieldMessage(errors.proxy?.dir)}
            adornment={<CopyButton value={form.watch('proxy.dir') ?? ''} label="proxy folder" />}
            {...form.register('proxy.dir')}
          />
        </div>
        <Controller
          control={form.control}
          name="exploreRedirect"
          render={({ field }) => (
            <div className={styles.toggleRow}>
              <div>
                <p className={styles.toggleTitle}>Explore redirect</p>
                <p className={styles.toggleNote}>
                  Send Explore-tool calls through the redirect target instead of the normal routing path.
                </p>
              </div>
              <Switch
                size="sm"
                aria-label="Explore redirect"
                stateText={{ on: 'On', off: 'Off' }}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
      </Section>

      <Controller
        control={form.control}
        name="projects"
        render={({ field }) => {
          const projects = field.value ?? {};
          const folders = Object.keys(projects);
          const candidate = newFolder.trim();
          const duplicate = candidate !== '' && Object.hasOwn(projects, candidate);

          function addProject() {
            if (candidate === '' || duplicate) return;
            field.onChange({ ...projects, [candidate]: { testCommand: '' } });
            setNewFolder('');
          }

          return (
            <Section
              title="Project commands"
              description="The test command routemax runs in each project folder to verify a delegate change before handing control back."
            >
              {folders.length === 0 ? (
                <p className={styles.empty}>No projects yet.</p>
              ) : (
                <ul className={styles.ledger}>
                  <li className={styles.ledgerHead} aria-hidden="true">
                    <span>Folder</span>
                    <span>Test command</span>
                  </li>
                  {folders.map((folder) => (
                    <li key={folder} className={styles.row}>
                      <span className={`${styles.folder} mono`} title={folder}>
                        {folder}
                      </span>
                      <TextField
                        className={styles.command}
                        label={`Test command for ${folder}`}
                        hideLabel
                        mono
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="npm test"
                        value={projects[folder].testCommand}
                        error={fieldMessage(projectErrors?.[folder]?.testCommand)}
                        adornment={<CopyButton value={projects[folder].testCommand} label={`${folder} test command`} />}
                        onChange={(event) => field.onChange({ ...projects, [folder]: { testCommand: event.target.value } })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconOnly
                        className={styles.remove}
                        icon={<Trash2 aria-hidden="true" />}
                        aria-label={`Remove ${folder}`}
                        onClick={() =>
                          field.onChange(Object.fromEntries(Object.entries(projects).filter(([other]) => other !== folder)))
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
              <form
                className={styles.add}
                onSubmit={(event) => {
                  event.preventDefault();
                  addProject();
                }}
              >
                <TextField
                  label="Project folder"
                  mono
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="/path/to/project"
                  value={newFolder}
                  error={duplicate ? 'This folder is already listed.' : undefined}
                  onChange={(event) => setNewFolder(event.target.value)}
                />
                <Button type="submit" variant="secondary" icon={<Plus aria-hidden="true" />} disabled={candidate === '' || duplicate}>
                  Add project
                </Button>
              </form>
            </Section>
          );
        }}
      />
    </div>
  );
}
