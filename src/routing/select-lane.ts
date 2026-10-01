import type { DelegateConfig, Effort, WorkerTier } from '../config/config-schema';
import { isPeak, priceFactor } from './peak';
import { fitEffort } from './resolve-effort';

export interface LaneSelection {
  lane: string;
  model: string;
  effort: Effort;
  peak: boolean;
  priceFactor: number;
}

const WORKER_EFFORT: Record<Effort, Effort> = { low: 'low', medium: 'high', high: 'high', xhigh: 'high', max: 'max' };

export function selectLane(config: DelegateConfig, tier: WorkerTier, taskType: string, now: Date): LaneSelection {
  const workerTier = config.tiers[tier];
  const peak = isPeak(config.providers[workerTier.provider].peak, now);
  const fallback = config.lanes.fallback;
  const useFallback = Boolean(fallback) && config.lanes.preferGlmAtPeak && peak;
  const lane = useFallback && fallback ? fallback : workerTier;
  const provider = config.providers[lane.provider];
  const wanted = WORKER_EFFORT[config.taskEfforts[taskType] ?? workerTier.effort];
  return {
    lane: lane.provider,
    model: lane.model,
    effort: fitEffort(wanted, provider.efforts),
    peak,
    priceFactor: priceFactor(provider.peak, now),
  };
}
