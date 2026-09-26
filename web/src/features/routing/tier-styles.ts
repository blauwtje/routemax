import type { Tier } from '../../../../src/config/config-schema';

export const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export const TIER_DOTS: Record<Tier, string> = {
  'flash-low': 'bg-chart-1',
  'flash-high': 'bg-chart-2',
  'pro-high': 'bg-chart-3',
  claude: 'bg-primary',
};
