import {
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  columnFilteringFeature,
  filterFn_equalsString,
  flexRender,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { ChevronRightIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Field } from '@/components/field';
import { StatusIndicator } from '@/components/status-indicator';
import { TierChip } from '@/components/tier-chip';
import type { DecisionRecord } from '@/lib/api-types';
import { formatTime, formatUsd } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface HistoryRow extends DecisionRecord {
  project: string;
  modelName: string;
}

const CELL_CLASSES: Record<string, string> = {
  ts: 'py-2 sticky left-0 z-10 bg-card',
  costUsd: 'py-2 text-right font-mono tabular-nums',
  modelName: 'py-2 font-mono text-sm',
  reason: 'py-2 whitespace-normal text-muted-foreground',
};

const FILTER_LABELS: Record<string, string> = { project: 'Project', status: 'Status', modelName: 'Model' };

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
});
const columnHelper = createColumnHelper<typeof features, HistoryRow>();
const FILTERED_COLUMNS = ['project', 'status', 'modelName'] as const;

const columns = columnHelper.columns([
  columnHelper.accessor('ts', { header: 'Time', sortFn: sortFn_text, cell: (cell) => formatTime(cell.getValue()) }),
  columnHelper.accessor('project', { header: 'Project', sortFn: sortFn_text, filterFn: filterFn_equalsString }),
  columnHelper.accessor('taskType', { header: 'Task type', sortFn: sortFn_text }),
  columnHelper.accessor('finalTier', { header: 'Tier', sortFn: sortFn_text, cell: (cell) => <TierChip tier={cell.getValue()} /> }),
  columnHelper.accessor('modelName', { header: 'Model', sortFn: sortFn_text, filterFn: filterFn_equalsString }),
  columnHelper.accessor('status', {
    header: 'Status',
    sortFn: sortFn_text,
    filterFn: filterFn_equalsString,
    cell: (cell) => <StatusIndicator value={cell.getValue()} />,
  }),
  columnHelper.accessor('reason', { header: 'Reason', sortFn: sortFn_text, cell: (cell) => cell.getValue() ?? '' }),
  columnHelper.accessor('costUsd', { header: 'Cost', sortFn: sortFn_basic, sortDescFirst: false, cell: (cell) => formatUsd(cell.getValue()) }),
]);

function sortMark(sorted: false | 'asc' | 'desc'): string {
  if (sorted === 'asc') return ' ↑';
  if (sorted === 'desc') return ' ↓';
  return '';
}

function ariaSort(sorted: false | 'asc' | 'desc'): 'ascending' | 'descending' | undefined {
  if (sorted === 'asc') return 'ascending';
  if (sorted === 'desc') return 'descending';
  return undefined;
}

/** Detail fields not already visible as a column, shown when a row expands. */
function RowDetails({ row }: { row: HistoryRow }) {
  const entries: [string, string][] = [
    ['Working directory', row.cwd],
    ['Requested tier', row.requestedTier],
    ['Raised by', row.raisedBy ?? 'None'],
    ['Provider', row.provider ?? 'None'],
    ['Effort', row.effort ?? 'None'],
    ['Duration', `${row.durationMs} ms`],
    ['Retries', String(row.retries)],
    ['Input tokens', row.inputTokens.toLocaleString()],
  ];
  return (
    <dl className="history-row-details grid grid-cols-2 gap-x-6 gap-y-2 px-2 py-3 sm:grid-cols-4">
      {entries.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">{label}</dt>
          <dd className="font-mono text-[13px] break-all text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const table = useTable({
    features,
    columns,
    data: rows,
  });
  const options = useMemo(
    () => Object.fromEntries(FILTERED_COLUMNS.map((key) => [key, [...new Set(rows.map((row) => row[key]))].sort()])),
    [rows],
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const shownCount = table.getRowModel().rows.length;
  const isFiltered = FILTERED_COLUMNS.some((key) => table.getColumn(key)?.getFilterValue() !== undefined);
  const clearFilters = () => {
    for (const key of FILTERED_COLUMNS) table.getColumn(key)?.setFilterValue(undefined);
  };
  const columnCount = columns.length + 1;

  return (
    <div className="history-table-wrap flex flex-col gap-4">
      <Card
        className="history-toolbar gap-0 motion-safe:animate-[page-enter_var(--dur-page)_var(--ease-out-expo)_both]"
        style={{ animationDelay: 'calc(var(--stagger-card) * 0)' }}
      >
        <CardContent className="flex flex-wrap items-end gap-4">
          {FILTERED_COLUMNS.map((key) => {
            const column = table.getColumn(key);
            const values: string[] = options[key] ?? [];
            return (
              <div key={key} className="w-full min-w-36 sm:w-44">
                <Field label={FILTER_LABELS[key]} htmlFor={`history-filter-${key}`}>
                  <NativeSelect
                    id={`history-filter-${key}`}
                    size="compact"
                    value={String(column?.getFilterValue() ?? '')}
                    onChange={(event) => column?.setFilterValue(event.target.value === '' ? undefined : event.target.value)}
                  >
                    <option value="">All</option>
                    {values.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            );
          })}
          <div className="ml-auto flex items-center gap-3">
            <p className="history-count text-sm text-muted-foreground">
              {shownCount} of {rows.length} calls
            </p>
            {isFiltered && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Card
        className="history-table-panel gap-0 motion-safe:animate-[page-enter_var(--dur-page)_var(--ease-out-expo)_both]"
        style={{ animationDelay: 'calc(var(--stagger-card) * 1)' }}
      >
        <CardContent className="px-0">
          <Table className="history-table tabular-nums" aria-label="Call history">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="h-10 hover:bg-transparent">
                  <TableHead aria-hidden="true" className="w-10 px-2" />
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        aria-sort={ariaSort(sorted)}
                        className={cn(
                          'history-table-head h-auto py-2 align-top',
                          header.column.id === 'costUsd' && 'text-right',
                          header.column.id === 'ts' && 'sticky left-0 z-20 bg-card',
                        )}
                      >
                        <button
                          type="button"
                          className="history-table-sort min-h-6 rounded-sm text-[13px] font-semibold tracking-[0.04em] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortMark(sorted)}
                        </button>
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody translate="no">
              {table.getRowModel().rows.map((row) => {
                const expanded = expandedId === row.id;
                return (
                  <>
                    <TableRow key={row.id} className="h-10">
                      <TableCell className="py-2 pr-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-expanded={expanded}
                          aria-label={expanded ? 'Hide call details' : 'Show call details'}
                          onClick={() => setExpandedId(expanded ? null : row.id)}
                        >
                          <ChevronRightIcon
                            aria-hidden="true"
                            className={cn('size-3.5 motion-safe:transition-transform motion-safe:duration-(--dur-feedback) motion-safe:ease-out-expo', expanded && 'rotate-90')}
                          />
                        </Button>
                      </TableCell>
                      {row.getAllCells().map((cell) => (
                        <TableCell key={cell.id} className={CELL_CLASSES[cell.column.id] ?? 'py-2'}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    <tr aria-hidden={!expanded}>
                      <td colSpan={columnCount} className="p-0">
                        <div
                          className="grid motion-safe:transition-[grid-template-rows] motion-safe:duration-[240ms] motion-safe:ease-out-expo"
                          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                        >
                          <div className="overflow-hidden">
                            <RowDetails row={row.original} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
