import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePoll } from '@/hooks/use-poll';
import type { DoctorResponse, StatsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { type Period } from './overview-figures';
import { OverviewLedger } from './overview-ledger';
import { StatusHeader } from './status-header';
import { TierBreakdown } from './tier-breakdown';
import { useDailyTierSpend } from './use-daily-tier-spend';

const loadStats = () => api.request<StatsResponse>('GET', '/api/stats');
const loadDoctor = () => api.request<DoctorResponse>('GET', '/api/doctor');

const PERIOD_LABELS: Record<Period, string> = { today: 'Today', week: 'This week' };

export function OverviewPage() {
  const { state: statsState } = usePoll(loadStats);
  const { state: doctorState, refresh: refreshDoctor } = usePoll(loadDoctor);
  const [period, setPeriod] = useState<Period>('week');
  const dailyTierSpend = useDailyTierSpend(statsState.kind === 'loaded' ? statsState.value.claudeByDay : undefined);

  return (
    <div className="overview-page flex flex-col gap-8">
      <StatusHeader
        budget={statsState.kind === 'loaded' ? statsState.value.budget : undefined}
        stats={statsState.kind === 'loaded' ? statsState.value[period] : undefined}
        period={period}
        onPeriodChange={setPeriod}
      />
      {statsState.kind === 'loading' && <p className="text-sm text-muted-foreground">Loading stats…</p>}
      {statsState.kind === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription>{statsState.message}</AlertDescription>
        </Alert>
      )}
      {statsState.kind === 'loaded' && (
        <>
          {statsState.error !== null && (
            <Alert variant="destructive">
              <AlertDescription>{statsState.error}</AlertDescription>
            </Alert>
          )}
          <TierBreakdown stats={statsState.value[period]} periodLabel={PERIOD_LABELS[period]} dailyTierSpend={dailyTierSpend} />
          <OverviewLedger
            stats={statsState.value[period]}
            periodLabel={PERIOD_LABELS[period]}
            doctor={doctorState}
            onRefreshDoctor={refreshDoctor}
          />
        </>
      )}
    </div>
  );
}
