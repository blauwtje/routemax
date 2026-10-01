import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import styles from './data-table.module.css';

export type SortState = { key: string; direction: 'asc' | 'desc' } | null;

export type Column<Row> = {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  /** Right-aligned, mono, tabular: money, counts, durations. */
  numeric?: boolean;
  /** Mono without right alignment: ids and models. */
  mono?: boolean;
  sortable?: boolean;
};

type DataTableProps<Row> = {
  columns: Column<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  'aria-label': string;
  sort?: SortState;
  /** Cycle is asc, desc, none so an accidental sort has a way out. */
  onSortChange?: (sort: SortState) => void;
  /** Makes the first cell a toggle that reveals this row's details. */
  renderDetails?: (row: Row) => ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
};

function nextSort(current: SortState, key: string): SortState {
  if (current?.key !== key) return { key, direction: 'asc' };
  return current.direction === 'asc' ? { key, direction: 'desc' } : null;
}

export function DataTable<Row>({ columns, rows, getRowId, sort = null, onSortChange, renderDetails, loading, skeletonRows = 6, empty, ...rest }: DataTableProps<Row>) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const baseId = useId();
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    // The scroll region is focusable so keyboard users can scroll a wide table.
    <div className={styles.scroller} role="region" aria-label={rest['aria-label']} tabIndex={0}>
      <table className={styles.table} aria-busy={loading || undefined}>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key ? sort : null;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={styles.th}
                  data-numeric={column.numeric || undefined}
                  aria-sort={column.sortable ? (active ? (active.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                >
                  {column.sortable && onSortChange ? (
                    <button type="button" className={styles.sort} onClick={() => onSortChange(nextSort(sort, column.key))}>
                      {column.header}
                      <span className={styles.arrow} data-active={active ? '' : undefined} aria-hidden="true">
                        {active?.direction === 'desc' ? <ArrowDown /> : <ArrowUp />}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }, (_, index) => (
                <tr key={index} className={styles.tr}>
                  {columns.map((column) => (
                    <td key={column.key} className={styles.td}>
                      <span className={styles.bar} data-numeric={column.numeric || undefined} />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          {!loading && rows.length === 0 ? (
            <tr>
              <td className={styles.emptyCell} colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : null}
          {!loading
            ? rows.map((row) => {
                const id = getRowId(row);
                const open = expanded.has(id);
                const detailsId = `${baseId}-${id}`;
                return (
                  <FragmentRow key={id} open={open} details={renderDetails && open ? renderDetails(row) : null} detailsId={detailsId} span={columns.length}>
                    {columns.map((column, index) => (
                      <td key={column.key} className={styles.td} data-numeric={column.numeric || undefined} data-mono={column.mono || column.numeric || undefined} data-sticky={index === 0 || undefined}>
                        {index === 0 && renderDetails ? (
                          <button type="button" className={styles.expander} aria-expanded={open} aria-controls={detailsId} onClick={() => toggle(id)}>
                            <ChevronRight className={styles.chevron} aria-hidden="true" />
                            {column.render(row)}
                          </button>
                        ) : (
                          column.render(row)
                        )}
                      </td>
                    ))}
                  </FragmentRow>
                );
              })
            : null}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ children, open, details, detailsId, span }: { children: ReactNode; open: boolean; details: ReactNode; detailsId: string; span: number }) {
  return (
    <>
      <tr className={styles.tr} data-open={open || undefined}>
        {children}
      </tr>
      {open ? (
        <tr className={styles.detailsRow}>
          <td id={detailsId} colSpan={span} className={styles.details}>
            {details}
          </td>
        </tr>
      ) : null}
    </>
  );
}
