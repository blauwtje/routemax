import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { PeriodStats } from '@/lib/api-types';
import { formatUsd } from '@/lib/format';

const MODEL_CHART: ChartConfig = { costUsd: { label: 'Cost (USD)', color: 'var(--chart-1)' } };
const CHART_STEPS = 5;

function chartStep(index: number): string {
  return `var(--chart-${Math.min(index + 1, CHART_STEPS)})`;
}

interface PeriodCardProps {
  title: string;
  icon: LucideIcon;
  stats: PeriodStats;
}

export function PeriodCard({ title, icon: Icon, stats }: PeriodCardProps) {
  const tiers = Object.entries(stats.byTier);
  const models = Object.entries(stats.byModel).map(([model, { calls, costUsd }]) => ({ model, calls, costUsd }));
  const escalations = Object.entries(stats.escalations);

  return (
    <Card className="period-card">
      <CardHeader className="grid-cols-[auto_1fr] gap-x-3">
        <span aria-hidden="true" className="row-span-2 grid size-10 place-items-center rounded-lg bg-primary/15 text-primary">
          <Icon className="size-5" />
        </span>
        <CardTitle role="heading" aria-level={2} className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <CardDescription className="text-foreground">
          <span className="font-heading text-3xl font-extrabold tracking-tight">{stats.calls}</span>{' '}
          {stats.calls === 1 ? 'call' : 'calls'}, {formatUsd(stats.costUsd)}
        </CardDescription>
      </CardHeader>
      <CardContent className="period-card-body flex flex-col gap-5">
        {stats.calls === 0 ? (
          <p className="text-sm text-muted-foreground">No calls in this period.</p>
        ) : (
          <>
            <section aria-label={`${title} by tier`} className="flex flex-col gap-2">
              <h3 className="period-card-heading text-sm font-medium text-muted-foreground">By tier</h3>
              <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm">
                {tiers.map(([tier, { calls, costUsd }], index) => (
                  <div key={tier} className="contents">
                    <dt>{tier}</dt>
                    <dd className="text-right tabular-nums">{calls}</dd>
                    <dd className="text-right tabular-nums">{formatUsd(costUsd)}</dd>
                    <dd
                      aria-hidden="true"
                      className="col-span-3 mb-1 h-1.5 w-(--share) rounded-full bg-(--bar)"
                      style={{ '--share': `${(calls / stats.calls) * 100}%`, '--bar': chartStep(index) } as CSSProperties}
                    />
                  </div>
                ))}
              </dl>
            </section>
            <section aria-label={`${title} cost by model`} className="flex flex-col gap-2">
              <h3 className="period-card-heading text-sm font-medium text-muted-foreground">By model</h3>
              <ChartContainer config={MODEL_CHART} className="period-card-chart aspect-auto h-36 w-full">
                <BarChart data={models} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="model" width={120} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="costUsd" radius={4}>
                    {models.map(({ model }, index) => (
                      <Cell key={model} fill={chartStep(index)} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </section>
            <section aria-label={`${title} escalations`} className="flex flex-col gap-2">
              <h3 className="period-card-heading text-sm font-medium text-muted-foreground">Escalations</h3>
              {escalations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No escalations.</p>
              ) : (
                <ul className="flex flex-wrap gap-2 text-sm">
                  {escalations.map(([reason, count]) => (
                    <li
                      key={reason}
                      className="inline-flex items-center gap-1.5 rounded-full bg-status-escalate/15 px-2.5 py-0.5 font-medium text-status-escalate before:size-1.5 before:rounded-full before:bg-current"
                    >
                      {reason}: {count}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
