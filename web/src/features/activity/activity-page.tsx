import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/button/button';
import { StatusDot } from '@/components/badge/badge';
import { Select, type SelectOption } from '@/components/select/select';
import type { SortState } from '@/components/data-table/data-table';
import { usePoll } from '@/hooks/use-poll';
import type { DecisionRecord, HistoryResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { formatUsd } from '@/lib/format';
import { ActivityList, STATUS_LABELS, type ActivityRow } from './activity-list';
import styles from './activity-page.module.css';

const loadHistory = () => api.request<HistoryResponse>('GET', '/api/history');

const ALL = '__all';
const NO_PROVIDER = '__none';

const TIER_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'All tiers' },
  { value: 'flash-low', label: 'Flash low', tier: 'flash-low' },
  { value: 'flash-high', label: 'Flash high', tier: 'flash-high' },
  { value: 'pro-high', label: 'Pro high', tier: 'pro-high' },
  { value: 'claude', label: 'Claude', tier: 'claude' },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'All statuses' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

type Filters = { status: string; tier: string; provider: string };
const NO_FILTERS: Filters = { status: ALL, tier: ALL, provider: ALL };

/** Records arrive oldest first; the ledger reads newest first, and the id keeps an open row open across polls. */
function toRows(records: DecisionRecord[]): ActivityRow[] {
  return records
    .map((record, index) => ({
      ...record,
      id: `${index}-${record.ts}`,
      project: record.cwd.split('/').filter(Boolean).at(-1) ?? record.cwd,
    }))
    .reverse();
}

function matches(row: ActivityRow, filters: Filters): boolean {
  if (filters.status !== ALL && row.status !== filters.status) return false;
  if (filters.tier !== ALL && row.finalTier !== filters.tier) return false;
  if (filters.provider === NO_PROVIDER) return row.provider === null;
  return filters.provider === ALL || row.provider === filters.provider;
}

function providerOptions(rows: ActivityRow[]): SelectOption[] {
  const names = [...new Set(rows.flatMap((row) => (row.provider === null ? [] : [row.provider])))].sort((a, b) => a.localeCompare(b));
  const options: SelectOption[] = [{ value: ALL, label: 'All providers' }, ...names.map((name) => ({ value: name, label: name }))];
  if (rows.some((row) => row.provider === null)) options.push({ value: NO_PROVIDER, label: 'No provider' });
  return options;
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.figure}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ActivityPage() {
  const { state, refresh } = usePoll(loadHistory);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortState>(null);
  const [retrying, setRetrying] = useState(false);
  const statusId = useId();
  const tierId = useId();
  const providerId = useId();

  // Every poll result, success or failure, ends a retry.
  useEffect(() => setRetrying(false), [state]);

  const loaded = state.kind === 'loaded';
  const allRows = useMemo(() => (state.kind === 'loaded' ? toRows(state.value.records) : []), [state]);
  const rows = useMemo(() => allRows.filter((row) => matches(row, filters)), [allRows, filters]);
  const providers = useMemo(() => providerOptions(allRows), [allRows]);
  const spent = useMemo(() => rows.reduce((total, row) => total + row.costUsd, 0), [rows]);
  const filtered = filters.status !== ALL || filters.tier !== ALL || filters.provider !== ALL;
  const clearFilters = () => setFilters(NO_FILTERS);
  const controlsOff = !loaded || allRows.length === 0;

  const empty =
    allRows.length === 0 ? (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No calls logged yet</p>
        <p className={styles.emptyHint}>History fills in once the router makes its first decision.</p>
      </div>
    ) : (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No calls match these filters</p>
        <p className={styles.emptyHint}>
          <span className={styles.mono}>{allRows.length.toLocaleString('en-US')}</span> calls are logged. Widen the status, tier or provider to see them.
        </p>
        <Button size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>
    );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.title}>
          <h1>Activity</h1>
          <p>Every routing decision, newest first.</p>
        </div>
        <dl className={styles.figures} aria-live="polite" aria-atomic="true" aria-busy={!loaded}>
          <Figure label="Calls">
            {loaded ? (
              <>
                <span className={styles.big}>{rows.length.toLocaleString('en-US')}</span>
                <span className={styles.of}> of {allRows.length.toLocaleString('en-US')}</span>
              </>
            ) : (
              <span className={styles.pending}>–</span>
            )}
          </Figure>
          <Figure label="Cost">{loaded ? <span className={styles.big}>{formatUsd(spent)}</span> : <span className={styles.pending}>–</span>}</Figure>
        </dl>
      </header>

      <div className={styles.toolbar} role="group" aria-label="Filter calls">
        <div className={styles.field}>
          <label htmlFor={statusId}>Status</label>
          <Select id={statusId} aria-label="Status" options={STATUS_OPTIONS} value={filters.status} onValueChange={(status) => setFilters({ ...filters, status })} disabled={controlsOff} />
        </div>
        <div className={styles.field}>
          <label htmlFor={tierId}>Tier</label>
          <Select id={tierId} aria-label="Tier" options={TIER_OPTIONS} value={filters.tier} onValueChange={(tier) => setFilters({ ...filters, tier })} disabled={controlsOff} />
        </div>
        <div className={styles.field}>
          <label htmlFor={providerId}>Provider</label>
          <Select
            id={providerId}
            aria-label="Provider"
            mono
            options={providers}
            value={filters.provider}
            onValueChange={(provider) => setFilters({ ...filters, provider })}
            disabled={controlsOff}
            emptyText="No provider has been used yet."
          />
        </div>
        <div className={styles.clear}>
          {filtered ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {state.kind === 'loaded' && state.error !== null ? (
        <div className={styles.notice} role="status">
          <StatusDot tone="warn" />
          <p>
            Could not refresh. Showing the calls from the last update. <span className={styles.detail}>{state.error}</span>
          </p>
          <Button size="sm" variant="secondary" loading={retrying} onClick={() => { setRetrying(true); refresh(); }}>
            Try again
          </Button>
        </div>
      ) : null}

      {state.kind === 'failed' ? (
        <div className={styles.failure} role="alert">
          <StatusDot tone="danger" />
          <div className={styles.failureText}>
            <p className={styles.emptyTitle}>The call log did not load</p>
            <p className={styles.emptyHint}>{state.message}</p>
          </div>
          <Button size="sm" loading={retrying} onClick={() => { setRetrying(true); refresh(); }}>
            Try again
          </Button>
        </div>
      ) : (
        <ActivityList rows={rows} loading={state.kind === 'loading'} sort={sort} onSortChange={setSort} empty={empty} />
      )}
    </div>
  );
}
