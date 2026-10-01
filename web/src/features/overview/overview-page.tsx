import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Badge, StatusDot, type TierId } from '@/components/badge/badge';
import { Button } from '@/components/button/button';
import { List, ListEmpty, ListRow, ListSkeleton } from '@/components/list/list';
import { Switch } from '@/components/switch/switch';
import { Tooltip } from '@/components/tooltip/tooltip';
import { useCountUp } from '@/hooks/use-count-up';
import { usePoll, type PollState } from '@/hooks/use-poll';
import { useRouterSwitch } from '@/hooks/use-router-switch';
import type { DoctorResponse, PeriodStats, StatsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { formatUsd } from '@/lib/format';
import styles from './overview-page.module.css';

// The budget covers DeepSeek work only; Claude's cost is an API-equivalent estimate beside it.
const BUDGET_TIERS: readonly TierId[] = ['flash-low', 'flash-high', 'pro-high'];
const ALL_TIERS: readonly TierId[] = [...BUDGET_TIERS, 'claude'];
const TIER_NAMES: Record<TierId, string> = { 'flash-low': 'Flash low', 'flash-high': 'Flash high', 'pro-high': 'Pro high', claude: 'Claude' };
const CLAUDE_NOTE =
  "Estimated from Claude Code's session logs on this Mac at Anthropic list prices; not your actual bill and not counted in the budget.";
const COUNT_UP_MS = 600;

type Period = 'week' | 'today';
const PERIODS: readonly { key: Period; label: string; phrase: string }[] = [
  { key: 'week', label: 'This week', phrase: 'this week' },
  { key: 'today', label: 'Today', phrase: 'today' },
];

const countFormat = new Intl.NumberFormat('en-US');
const loadStats = () => api.request<StatsResponse>('GET', '/api/stats');

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className={styles.notice} role="alert">
      <StatusDot tone="danger" />
      <span>{children}</span>
    </p>
  );
}

/** Counts up once when it first appears, then follows the value (the page polls every 30s). */
function Figure({ value }: { value: number }) {
  const counted = useCountUp(value, COUNT_UP_MS);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), COUNT_UP_MS + 50);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <>
      <span className={styles.figure} aria-hidden="true">
        {formatUsd(settled ? value : counted)}
      </span>
      <span className={styles.srOnly}>{formatUsd(value)}</span>
    </>
  );
}

function RouterPanel() {
  const { state, setEnabled } = useRouterSwitch();
  return (
    <section className={styles.card} aria-labelledby="overview-router" data-region="router">
      <header className={styles.cardHead}>
        <h2 id="overview-router" className={styles.cardTitle}>
          Router
        </h2>
        {state.kind === 'ready' ? (
          <Switch
            size="lg"
            label="Route to workers"
            stateText={{ on: 'On', off: 'Off' }}
            checked={state.enabled}
            busy={state.saving}
            onCheckedChange={(next) => void setEnabled(next)}
          />
        ) : (
          <Switch size="lg" label="Route to workers" checked={false} disabled onCheckedChange={() => undefined} />
        )}
      </header>
      {state.kind === 'loading' && (
        <div className={styles.routerBody} aria-busy="true" aria-label="Loading router state">
          <span className={styles.skeleton} data-shape="verdict" />
          <span className={styles.skeleton} data-shape="note" />
        </div>
      )}
      {state.kind === 'failed' && (
        <div className={styles.routerBody}>
          <Notice>The router state could not be read. {state.message}</Notice>
        </div>
      )}
      {state.kind === 'ready' && (
        <div className={styles.routerBody}>
          <p key={String(state.enabled)} className={styles.verdict}>
            {state.enabled ? 'Routing to workers.' : 'Everything stays on Claude.'}
          </p>
          <p className={styles.note}>
            An open Claude session may keep showing delegate until it refreshes its tool list.
            {state.enabled ? '' : ' While the router is off, delegate hands every call back to Claude.'}
          </p>
          {state.error !== null && <Notice>The change was not saved. {state.error}</Notice>}
          <p className={styles.srOnly} role="status">
            {state.saving ? 'Saving the router setting' : ''}
          </p>
        </div>
      )}
    </section>
  );
}

function SpendFigures({ stats }: { stats: StatsResponse }) {
  const { budget, week } = stats;
  const total = budget.totalUsd;
  const rawSegments = BUDGET_TIERS.map((tier) => {
    const costUsd = week.byTier[tier]?.costUsd ?? 0;
    return { tier, costUsd, percent: total > 0 ? (costUsd / total) * 100 : 0 };
  });
  const rawSum = rawSegments.reduce((sum, segment) => sum + segment.percent, 0);
  // Over budget: scale the segments so the bar fills exactly and never overflows.
  const scale = rawSum > 100 ? 100 / rawSum : 1;
  const segments = rawSegments.map((segment) => ({ ...segment, percent: segment.percent * scale }));
  const over = total > 0 && budget.spentUsd > total;
  const summary = segments.map((segment) => `${TIER_NAMES[segment.tier]} ${formatUsd(segment.costUsd)}`).join(', ');
  const remainder = total > 0 ? `${formatUsd(budget.leftUsd)} left of ${formatUsd(total)}` : 'No budget set';

  return (
    <>
      <div className={styles.figureRow}>
        <Figure value={budget.spentUsd} />
        <span className={styles.ofTotal}>{total > 0 ? `of ${formatUsd(total)} budget` : 'no budget set'}</span>
        {total > 0 && (
          <span className={styles.left} data-over={over || undefined}>
            {over ? `Over by ${formatUsd(budget.spentUsd - total)}` : `${formatUsd(budget.leftUsd)} left`}
          </span>
        )}
      </div>
      <div className={styles.bar} role="img" aria-label={`Budget used by tier: ${summary}. ${remainder}`}>
        {segments
          .filter((segment) => segment.costUsd > 0)
          .map((segment) => (
            <span key={segment.tier} className={styles.segment} data-tier={segment.tier} style={{ '--w': `${segment.percent}%` } as CSSProperties} />
          ))}
      </div>
      <ul className={styles.legend} aria-label="Spend by tier">
        {segments.map((segment) => (
          <li key={segment.tier}>
            <Badge tier={segment.tier} />
            <span className={styles.mono}>{formatUsd(segment.costUsd)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.claudeLine}>
        Claude <span className={styles.mono}>{formatUsd(week.claude.costUsd)}</span>{' '}
        <Tooltip content={CLAUDE_NOTE}>
          <button type="button" className={styles.hint}>
            API-equivalent
          </button>
        </Tooltip>
        , estimated from session logs and not counted in the budget.
      </p>
    </>
  );
}

function SpendCard({ state, onRetry }: { state: PollState<StatsResponse>; onRetry: () => void }) {
  return (
    <section className={styles.card} data-focal="" aria-labelledby="overview-spend" data-region="spend">
      <header className={styles.cardHead}>
        <h2 id="overview-spend" className={styles.cardTitle}>
          Spend this week
        </h2>
        {state.kind === 'loaded' && (
          <span className={styles.meta}>
            <span className={styles.mono}>{countFormat.format(state.value.week.calls)}</span> calls
          </span>
        )}
      </header>
      {state.kind === 'loading' && (
        <div className={styles.spendBody} aria-busy="true" aria-label="Loading spend">
          <span className={styles.skeleton} data-shape="figure" />
          <span className={styles.skeleton} data-shape="bar" />
          <span className={styles.skeleton} data-shape="note" />
        </div>
      )}
      {state.kind === 'failed' && (
        <div className={styles.spendBody}>
          <Notice>Spend could not be loaded. {state.message}</Notice>
          <div>
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        </div>
      )}
      {state.kind === 'loaded' && (
        <div className={styles.spendBody}>
          <SpendFigures stats={state.value} />
        </div>
      )}
    </section>
  );
}

interface LedgerRow {
  key: string;
  cells: ReactNode[];
}

/** A hairline ledger: the first column names the row, every other column is a right-aligned mono figure. */
function Ledger({ label, heads, rows, empty }: { label: string; heads: string[]; rows: LedgerRow[]; empty: string }) {
  if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <table className={styles.ledger} aria-label={label}>
      <thead>
        <tr>
          {heads.map((head, index) => (
            <th key={head} scope="col" data-numeric={index > 0 || undefined}>
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, index) =>
              index === 0 ? (
                <th key={index} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={index} data-numeric>
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function tierRows(stats: PeriodStats): LedgerRow[] {
  const callsOf = (tier: TierId) => stats.byTier[tier]?.calls ?? 0;
  const totalCalls = ALL_TIERS.reduce((sum, tier) => sum + callsOf(tier), 0);
  return ALL_TIERS.map((tier) => {
    const calls = callsOf(tier);
    const costUsd = tier === 'claude' ? stats.claude.costUsd : (stats.byTier[tier]?.costUsd ?? 0);
    const name =
      tier === 'claude' ? (
        <span className={styles.tierName}>
          <Badge tier={tier} />
          <Tooltip content={CLAUDE_NOTE}>
            <button type="button" className={styles.hint}>
              API-equivalent
            </button>
          </Tooltip>
        </span>
      ) : (
        <Badge tier={tier} />
      );
    const share = totalCalls > 0 ? Math.round((calls / totalCalls) * 100) : 0;
    return { key: tier, cells: [name, countFormat.format(calls), `${share}%`, formatUsd(costUsd)] };
  });
}

function CallsDetail({ stats, spendByProvider, phrase }: { stats: PeriodStats; spendByProvider: Record<string, number>; phrase: string }) {
  const providers = Object.entries(spendByProvider).sort((a, b) => b[1] - a[1]);
  const models = Object.entries(stats.byModel).sort((a, b) => b[1].costUsd - a[1].costUsd);
  const escalations = Object.entries(stats.escalations).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <Ledger label={`Calls and spend by tier, ${phrase}`} heads={['Tier', 'Calls', 'Share', 'Spend']} rows={tierRows(stats)} empty="" />
      <div className={styles.minis}>
        <section aria-labelledby="overview-providers">
          <h3 id="overview-providers" className={styles.miniTitle}>
            By provider
            <span className={styles.meta}>budget week</span>
          </h3>
          <Ledger
            label="Spend by provider"
            heads={['Provider', 'Spend']}
            rows={providers.map(([id, costUsd]) => ({ key: id, cells: [<span className={styles.id}>{id}</span>, formatUsd(costUsd)] }))}
            empty="No provider spend yet."
          />
        </section>
        <section aria-labelledby="overview-models">
          <h3 id="overview-models" className={styles.miniTitle}>
            By model
          </h3>
          <Ledger
            label={`Calls and spend by model, ${phrase}`}
            heads={['Model', 'Calls', 'Spend']}
            rows={models.map(([id, entry]) => ({
              key: id,
              cells: [<span className={styles.id}>{id}</span>, countFormat.format(entry.calls), formatUsd(entry.costUsd)],
            }))}
            empty={`No calls ${phrase}.`}
          />
        </section>
        <section aria-labelledby="overview-escalations">
          <h3 id="overview-escalations" className={styles.miniTitle}>
            Escalations
          </h3>
          <Ledger
            label={`Escalations, ${phrase}`}
            heads={['Reason', 'Calls']}
            rows={escalations.map(([reason, calls]) => ({ key: reason, cells: [reason, countFormat.format(calls)] }))}
            empty={`No escalations ${phrase}.`}
          />
        </section>
      </div>
    </>
  );
}

function CallsCard({ state, period, onPeriodChange }: { state: PollState<StatsResponse>; period: Period; onPeriodChange: (period: Period) => void }) {
  const phrase = PERIODS.find((entry) => entry.key === period)?.phrase ?? '';
  return (
    <section className={styles.card} aria-labelledby="overview-calls" data-region="calls">
      <header className={styles.cardHead}>
        <h2 id="overview-calls" className={styles.cardTitle}>
          Calls and spend by tier
        </h2>
        <div className={styles.period} role="group" aria-label="Period">
          {PERIODS.map((entry) => (
            <button key={entry.key} type="button" aria-pressed={period === entry.key} onClick={() => onPeriodChange(entry.key)}>
              {entry.label}
            </button>
          ))}
        </div>
      </header>
      {state.kind === 'loading' && (
        <div className={styles.callsBody} aria-busy="true" aria-label="Loading calls">
          <span className={styles.skeleton} data-shape="table" />
        </div>
      )}
      {state.kind === 'failed' && <p className={styles.empty}>No figures while the stats are unavailable.</p>}
      {state.kind === 'loaded' && (
        <div className={styles.callsBody}>
          <CallsDetail stats={state.value[period]} spendByProvider={state.value.spendByProvider} phrase={phrase} />
        </div>
      )}
    </section>
  );
}

function HealthCard() {
  const [running, setRunning] = useState(false);
  const loadDoctor = useCallback(() => api.request<DoctorResponse>('GET', '/api/doctor').finally(() => setRunning(false)), []);
  const { state, refresh } = usePoll(loadDoctor);

  function runAgain() {
    setRunning(true);
    refresh();
  }

  const checks = state.kind === 'loaded' ? state.value.checks : [];
  const failing = checks.filter((check) => !check.ok).length;

  return (
    <section className={styles.card} aria-labelledby="overview-health" data-region="health">
      <header className={styles.cardHead}>
        <div className={styles.healthTitle}>
          <h2 id="overview-health" className={styles.cardTitle}>
            Health
          </h2>
          {state.kind === 'loaded' && checks.length > 0 && (
            <span className={styles.meta}>
              <StatusDot tone={failing === 0 ? 'ok' : 'danger'} />
              {failing === 0 ? `All ${checks.length} checks pass` : `${failing} of ${checks.length} checks fail`}
            </span>
          )}
        </div>
        <Button size="sm" loading={running} disabled={state.kind === 'loading'} onClick={runAgain}>
          {running ? 'Running…' : 'Run again'}
        </Button>
      </header>
      {state.kind === 'loading' && <ListSkeleton rows={3} />}
      {state.kind === 'failed' && (
        <div className={styles.healthNotice}>
          <Notice>The checks could not run. {state.message}</Notice>
        </div>
      )}
      {state.kind === 'loaded' && (
        <>
          {state.error !== null && (
            <div className={styles.healthNotice}>
              <Notice>The last run failed, so these results may be stale. {state.error}</Notice>
            </div>
          )}
          <div className={styles.healthList} data-running={running || undefined} aria-busy={running || undefined}>
            <List aria-label="Health checks">
              {checks.length === 0 ? (
                <ListEmpty>No checks reported.</ListEmpty>
              ) : (
                checks.map((check) => (
                  <ListRow
                    key={check.name}
                    title={check.name}
                    subtitle={check.message}
                    status={<Badge tone={check.ok ? 'ok' : 'danger'}>{check.ok ? 'OK' : 'Fail'}</Badge>}
                  />
                ))
              )}
            </List>
          </div>
        </>
      )}
    </section>
  );
}

export function OverviewPage() {
  const { state, refresh } = usePoll(loadStats);
  const [period, setPeriod] = useState<Period>('week');

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Overview</h1>
        <p className={styles.subtitle}>Routing tasks to DeepSeek workers</p>
      </header>
      {state.kind === 'loaded' && state.error !== null && <Notice>Showing the last figures; the refresh failed. {state.error}</Notice>}
      <div className={styles.summary}>
        <RouterPanel />
        <SpendCard state={state} onRetry={refresh} />
      </div>
      <CallsCard state={state} period={period} onPeriodChange={setPeriod} />
      <HealthCard />
    </div>
  );
}
