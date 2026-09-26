import { CalendarDaysIcon, SunIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePoll } from '@/hooks/use-poll';
import type { StatsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { HealthCard } from './health-card';
import { PeriodCard } from './period-card';
import { RouterSwitchCard } from './router-switch-card';
import { SpendCard } from './spend-card';

const loadStats = () => api.request<StatsResponse>('GET', '/api/stats');

export function OverviewPage() {
  const { state: statsState } = usePoll(loadStats);

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
          {statsState.error !== null && (
            <Alert variant="destructive">
              <AlertDescription>{statsState.error}</AlertDescription>
            </Alert>
          )}
          <SpendCard budget={statsState.value.budget} spendByProvider={statsState.value.spendByProvider} />
          <div className="overview-periods grid items-start gap-6 lg:grid-cols-2">
            <PeriodCard title="Today" icon={SunIcon} stats={statsState.value.today} />
            <PeriodCard title="This week" icon={CalendarDaysIcon} stats={statsState.value.week} />
          </div>
        </div>
      )}
      <HealthCard />
    </div>
  );
}
