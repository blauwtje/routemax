import { useEffect, useState } from 'react';
import { CalendarDaysIcon, SunIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { StatsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';
import { PeriodCard } from './period-card';
import { RouterSwitchCard } from './router-switch-card';
import { SpendCard } from './spend-card';

type StatsState = { kind: 'loading' } | { kind: 'loaded'; stats: StatsResponse } | { kind: 'failed'; message: string };

export function OverviewPage() {
  const [statsState, setStatsState] = useState<StatsState>({ kind: 'loading' });

  useEffect(() => {
    api
      .request<StatsResponse>('GET', '/api/stats')
      .then((stats) => setStatsState({ kind: 'loaded', stats }))
      .catch((error: unknown) => setStatsState({ kind: 'failed', message: describeError(error) }));
  }, []);

  return (
    <div className="overview-page grid gap-6">
      <RouterSwitchCard />
      {statsState.kind === 'loading' && <p className="text-sm text-muted-foreground">Loading stats…</p>}
      {statsState.kind === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription>{statsState.message}</AlertDescription>
        </Alert>
      )}
      {statsState.kind === 'loaded' && (
        <div className="overview-stats grid gap-6">
          <SpendCard budget={statsState.stats.budget} spendByProvider={statsState.stats.spendByProvider} />
          <div className="overview-periods grid items-start gap-6 lg:grid-cols-2">
            <PeriodCard title="Today" icon={SunIcon} stats={statsState.stats.today} />
            <PeriodCard title="This week" icon={CalendarDaysIcon} stats={statsState.stats.week} />
          </div>
        </div>
      )}
    </div>
  );
}
