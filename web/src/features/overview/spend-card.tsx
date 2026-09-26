import type { CSSProperties } from 'react';
import { WalletIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { StatsResponse } from '@/lib/api-types';
import { formatUsd } from '@/lib/format';

interface SpendCardProps {
  budget: StatsResponse['budget'];
  spendByProvider: StatsResponse['spendByProvider'];
}

export function SpendCard({ budget, spendByProvider }: SpendCardProps) {
  const usedPercent = budget.totalUsd > 0 ? Math.min(100, (budget.spentUsd / budget.totalUsd) * 100) : 100;
  const providers = Object.entries(spendByProvider).sort(([, left], [, right]) => right - left);
  const largestSpend = providers.length > 0 ? providers[0][1] : 0;

  return (
    <Card className="spend-card md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:items-center">
      <CardHeader className="grid-cols-[auto_1fr] gap-x-3">
        <span aria-hidden="true" className="row-span-2 grid size-10 place-items-center rounded-lg bg-primary/15 text-primary">
          <WalletIcon className="size-5" />
        </span>
        <CardTitle role="heading" aria-level={2} className="text-sm font-medium text-muted-foreground">
          Spend
        </CardTitle>
        <CardDescription className="text-foreground">
          <span className="block font-heading text-3xl font-extrabold tracking-tight">{formatUsd(budget.spentUsd)}</span> of{' '}
          {formatUsd(budget.totalUsd)} spent, {formatUsd(budget.leftUsd)} left
        </CardDescription>
      </CardHeader>
      <CardContent className="spend-card-body flex flex-col gap-4">
        <Progress value={usedPercent} aria-label="Budget used" className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-foreground/10" />
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No spend yet.</p>
        ) : (
          <dl className="spend-card-providers grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            {providers.map(([providerId, amount], index) => (
              <div key={providerId} className="contents">
                <dt>{providerId}</dt>
                <dd className="text-right tabular-nums">{formatUsd(amount)}</dd>
                <dd
                  aria-hidden="true"
                  className="col-span-2 mb-1 h-1.5 w-(--share) rounded-full bg-(--bar)"
                  style={
                    {
                      '--share': `${largestSpend > 0 ? (amount / largestSpend) * 100 : 0}%`,
                      '--bar': `var(--chart-${Math.min(index + 1, 5)})`,
                    } as CSSProperties
                  }
                />
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
