import { InboxIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePoll } from '@/hooks/use-poll';
import type { DecisionRecord, HistoryResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { HistoryTable, type HistoryRow } from './history-table';

const loadHistory = () => api.request<HistoryResponse>('GET', '/api/history');
const SKELETON_ROW_COUNT = 6;

function toRow(record: DecisionRecord): HistoryRow {
  const project = record.cwd.split('/').filter(Boolean).at(-1) ?? record.cwd;
  return { ...record, project, modelName: record.model ?? 'none' };
}

/** Skeleton rows in a panel while the first page of history loads. */
function HistorySkeleton() {
  return (
    <Card className="history-skeleton gap-0" aria-hidden="true">
      <CardContent className="flex flex-col gap-2">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

/** Shown once loading finishes and no call has been logged yet. */
function HistoryEmpty() {
  return (
    <Card className="history-empty gap-0">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-md bg-surface-2 text-muted-foreground">
          <InboxIcon aria-hidden="true" className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">No calls logged yet. History fills in once the router makes its first decision.</p>
      </CardContent>
    </Card>
  );
}

export function HistoryPage() {
  const { state } = usePoll(loadHistory);
  const rows = useMemo(() => (state.kind === 'loaded' ? state.value.records.map(toRow).reverse() : []), [state]);

  return (
    <div className="history-page flex flex-col gap-4">
      {state.kind === 'loading' && <HistorySkeleton />}
      {state.kind === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.kind === 'loaded' && state.error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.kind === 'loaded' && (rows.length === 0 ? <HistoryEmpty /> : <HistoryTable rows={rows} />)}
    </div>
  );
}
