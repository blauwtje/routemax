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
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DecisionRecord, DecisionStatus } from '@/lib/api-types';
import { formatTime, formatUsd } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface HistoryRow extends DecisionRecord {
  project: string;
  modelName: string;
}

const STATUS_TINTS: Record<DecisionStatus, string> = {
  done: 'bg-status-done/15 text-status-done',
  escalate: 'bg-status-escalate/15 text-status-escalate',
  use_claude: 'bg-status-use-claude/15 text-status-use-claude',
  refused: 'bg-status-refused/15 text-status-refused',
  disabled: 'bg-status-disabled/15 text-status-disabled',
};

const CELL_CLASSES: Record<string, string> = {
  costUsd: 'py-2.5 text-right',
  reason: 'py-2.5 whitespace-normal text-muted-foreground',
};

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
  columnHelper.accessor('finalTier', { header: 'Tier', sortFn: sortFn_text }),
  columnHelper.accessor('modelName', { header: 'Model', sortFn: sortFn_text, filterFn: filterFn_equalsString }),
  columnHelper.accessor('status', {
    header: 'Status',
    sortFn: sortFn_text,
    filterFn: filterFn_equalsString,
    cell: (cell) => (
      <Badge variant="secondary" className={STATUS_TINTS[cell.getValue()]}>
        {cell.getValue()}
      </Badge>
    ),
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

  return (
    <Table className="history-table tabular-nums">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map((header) => {
              const filterValues: string[] | undefined = options[header.column.id];
              const sorted = header.column.getIsSorted();
              return (
                <TableHead
                  key={header.id}
                  aria-sort={ariaSort(sorted)}
                  className={cn('history-table-head h-auto py-2 align-top', header.column.id === 'costUsd' && 'text-right')}
                >
                  <button
                    type="button"
                    className="history-table-sort min-h-6 rounded-sm text-xs font-medium tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sortMark(sorted)}
                  </button>
                  {filterValues !== undefined && (
                    <select
                      aria-label={`Filter by ${header.column.id === 'modelName' ? 'model' : header.column.id}`}
                      className="history-table-filter mt-1 block min-h-6 w-full rounded-md border bg-background px-1 py-0.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      value={String(header.column.getFilterValue() ?? '')}
                      onChange={(event) => header.column.setFilterValue(event.target.value === '' ? undefined : event.target.value)}
                    >
                      <option value="">All</option>
                      {filterValues.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody translate="no">
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id} className={CELL_CLASSES[cell.column.id] ?? 'py-2.5'}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
