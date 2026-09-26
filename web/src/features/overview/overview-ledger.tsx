import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DoctorResponse, PeriodStats } from '@/lib/api-types';
import type { PollState } from '@/hooks/use-poll';
import { formatUsd } from '@/lib/format';

interface OverviewLedgerProps {
  stats: PeriodStats;
  periodLabel: string;
  doctor: PollState<DoctorResponse>;
  onRefreshDoctor: () => void;
}

/** By model, Escalations and Health as machined panels (contract: machined-surfaces). */
export function OverviewLedger({ stats, periodLabel, doctor, onRefreshDoctor }: OverviewLedgerProps) {
  const periodPhrase = periodLabel.toLowerCase();
  const models = Object.entries(stats.byModel).map(([model, { calls, costUsd }]) => ({ model, calls, costUsd }));
  const escalations = Object.entries(stats.escalations);
  const doctorRunning = doctor.kind === 'loading';

  return (
    <div className="overview-ledger flex flex-col gap-6">
      <div className="overview-ledger-tables grid gap-6 lg:grid-cols-2">
        <Card className="overview-ledger-models">
          <CardHeader>
            <CardTitle>By model</CardTitle>
          </CardHeader>
          <CardContent>
            {models.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calls {periodPhrase}.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map(({ model, calls, costUsd }) => (
                    <TableRow key={model}>
                      <TableCell className="truncate font-mono">{model}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{calls}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatUsd(costUsd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card className="overview-ledger-escalations">
          <CardHeader>
            <CardTitle>Escalations</CardTitle>
          </CardHeader>
          <CardContent>
            {escalations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No escalations {periodPhrase}.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {escalations.map(([reason, count]) => (
                    <TableRow key={reason}>
                      <TableCell>{reason}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="overview-ledger-health">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Health</span>
            <Button type="button" variant="outline" size="sm" onClick={onRefreshDoctor} disabled={doctorRunning}>
              {doctorRunning && (
                <span
                  aria-hidden="true"
                  className="mr-1.5 inline-block size-3.5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
                />
              )}
              {doctorRunning ? 'Running…' : 'Run again'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {doctorRunning && (
            <div className="flex flex-col gap-2" aria-hidden="true">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          )}
          {doctor.kind === 'failed' && <p className="text-sm text-status-negative">{doctor.message}</p>}
          {doctor.kind === 'loaded' && doctor.error !== null && <p className="text-sm text-status-negative">{doctor.error}</p>}
          {doctor.kind === 'loaded' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctor.value.checks.map((check) => (
                  <TableRow key={check.name}>
                    <TableCell className="font-medium">{check.name}</TableCell>
                    <TableCell className={check.ok ? 'font-medium text-status-positive' : 'font-medium text-status-negative'}>
                      {check.ok ? 'OK' : 'Fail'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{check.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
