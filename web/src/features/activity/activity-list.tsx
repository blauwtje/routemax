import type { ReactNode } from 'react';
import { Badge, type Tone, type TierId } from '@/components/badge/badge';
import { DataTable, type Column, type SortState } from '@/components/data-table/data-table';
import type { DecisionRecord, DecisionStatus } from '@/lib/api-types';
import { formatUsd } from '@/lib/format';
import styles from './activity-list.module.css';

export interface ActivityRow extends DecisionRecord {
  /** Stable across polls for the same record order, so an open row stays open. */
  id: string;
  project: string;
}

export const STATUS_LABELS: Record<DecisionStatus, string> = {
  done: 'Done',
  escalate: 'Escalate',
  use_claude: 'Use Claude',
  refused: 'Refused',
  disabled: 'Disabled',
};

const STATUS_TONES: Record<DecisionStatus, Tone> = {
  done: 'ok',
  escalate: 'warn',
  use_claude: 'info',
  refused: 'danger',
  disabled: 'neutral',
};

const TIER_RANK: Record<TierId, number> = { 'flash-low': 0, 'flash-high': 1, 'pro-high': 2, claude: 3 };

const ledgerTime = new Intl.DateTimeFormat('en-GB', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fullTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });

function formatLedgerTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : ledgerTime.format(date);
}

function formatFullTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : fullTime.format(date);
}

function Cost({ amount }: { amount: number }) {
  return <span className={amount === 0 ? styles.none : undefined}>{formatUsd(amount)}</span>;
}

const COLUMNS: Column<ActivityRow>[] = [
  { key: 'ts', header: 'Time', mono: true, sortable: true, render: (row) => formatLedgerTime(row.ts) },
  { key: 'project', header: 'Project', sortable: true, render: (row) => <span className={styles.clip}>{row.project}</span> },
  { key: 'taskType', header: 'Task', sortable: true, render: (row) => row.taskType },
  { key: 'finalTier', header: 'Tier', sortable: true, render: (row) => <Badge tier={row.finalTier} /> },
  {
    key: 'model',
    header: 'Model',
    mono: true,
    sortable: true,
    render: (row) => <span className={row.model === null ? styles.none : undefined}>{row.model ?? 'none'}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (row) => <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
  },
  {
    key: 'reason',
    header: 'Reason',
    sortable: true,
    render: (row) => (row.reason ? <span className={`${styles.clip} ${styles.reason}`} title={row.reason}>{row.reason}</span> : <span className={styles.none}>none</span>),
  },
  { key: 'costUsd', header: 'Cost', numeric: true, sortable: true, render: (row) => <Cost amount={row.costUsd} /> },
];

const COMPARATORS: Record<string, (a: ActivityRow, b: ActivityRow) => number> = {
  ts: (a, b) => Date.parse(a.ts) - Date.parse(b.ts),
  project: (a, b) => a.project.localeCompare(b.project),
  taskType: (a, b) => a.taskType.localeCompare(b.taskType),
  finalTier: (a, b) => TIER_RANK[a.finalTier] - TIER_RANK[b.finalTier],
  model: (a, b) => (a.model ?? '').localeCompare(b.model ?? ''),
  status: (a, b) => STATUS_LABELS[a.status].localeCompare(STATUS_LABELS[b.status]),
  reason: (a, b) => (a.reason ?? '').localeCompare(b.reason ?? ''),
  costUsd: (a, b) => a.costUsd - b.costUsd,
};

/** Rows arrive newest first; no sort keeps that order, a sort replaces it. Array#sort is stable. */
export function sortRows(rows: ActivityRow[], sort: SortState): ActivityRow[] {
  if (sort === null) return rows;
  const compare = COMPARATORS[sort.key];
  if (!compare) return rows;
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => direction * compare(a, b));
}

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={styles.fact} data-wide={wide || undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function none(value: string | null): ReactNode {
  return value === null ? <span className={styles.none}>none</span> : value;
}

function RowDetails({ row }: { row: ActivityRow }) {
  return (
    <div className={styles.details}>
      <dl className={styles.lead}>
        <Fact label="Logged">{formatFullTime(row.ts)}</Fact>
        <Fact label="Working directory">{row.cwd}</Fact>
        {row.reason ? <Fact label="Reason">{row.reason}</Fact> : null}
      </dl>
      <div className={styles.groups}>
        <dl className={styles.group} role="group" aria-label="Routing">
          <Fact label="Requested tier"><Badge tier={row.requestedTier} /></Fact>
          <Fact label="Final tier"><Badge tier={row.finalTier} /></Fact>
          <Fact label="Raised by">{none(row.raisedBy)}</Fact>
          <Fact label="Provider">{none(row.provider)}</Fact>
          <Fact label="Effort">{none(row.effort)}</Fact>
        </dl>
        <dl className={styles.group} role="group" aria-label="Run">
          <Fact label="Duration">{row.durationMs.toLocaleString('en-US')} ms</Fact>
          <Fact label="Retries">{row.retries.toLocaleString('en-US')}</Fact>
          <Fact label="Cost">{formatUsd(row.costUsd)}</Fact>
        </dl>
        <dl className={styles.group} role="group" aria-label="Tokens">
          <Fact label="Input">{row.inputTokens.toLocaleString('en-US')}</Fact>
          <Fact label="Output">{row.outputTokens.toLocaleString('en-US')}</Fact>
          <Fact label="Cache read">{row.cacheReadTokens.toLocaleString('en-US')}</Fact>
          <Fact label="Cache creation">{row.cacheCreationTokens.toLocaleString('en-US')}</Fact>
        </dl>
      </div>
    </div>
  );
}

type ActivityListProps = {
  rows: ActivityRow[];
  loading?: boolean;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  empty: ReactNode;
};

export function ActivityList({ rows, loading, sort, onSortChange, empty }: ActivityListProps) {
  return (
    <DataTable
      aria-label="Call log"
      columns={COLUMNS}
      rows={sortRows(rows, sort)}
      getRowId={(row) => row.id}
      sort={sort}
      onSortChange={onSortChange}
      renderDetails={(row) => <RowDetails row={row} />}
      loading={loading}
      skeletonRows={6}
      empty={empty}
    />
  );
}
