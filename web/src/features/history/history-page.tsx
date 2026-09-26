import { HistoryIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { usePoll } from '@/hooks/use-poll';
import type { DecisionRecord, HistoryResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { HistoryTable, type HistoryRow } from './history-table';

const loadHistory = () => api.request<HistoryResponse>('GET', '/api/history');

function toRow(record: DecisionRecord): HistoryRow {
  const project = record.cwd.split('/').filter(Boolean).at(-1) ?? record.cwd;
  return { ...record, project, modelName: record.model ?? 'none' };
}

export function HistoryPage() {
  const { state } = usePoll(loadHistory);
  const rows = useMemo(() => (state.kind === 'loaded' ? state.value.records.map(toRow).reverse() : []), [state]);

  return (
    <div className="history-page flex flex-col gap-4">
      <h1 className="flex items-center gap-3 font-heading text-2xl font-bold tracking-tight">
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary">
          <HistoryIcon className="size-5" />
        </span>
        History
      </h1>
      {state.kind === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
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
      {state.kind === 'loaded' &&
        (rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No calls logged yet.</p>
        ) : (
          <Card className="history-card py-2">
            <CardContent className="px-2">
              <HistoryTable rows={rows} />
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
