import { EFFORT_ORDER, type DelegateConfig, type Effort } from '../config/delegate-config';

export function resolveEffort(effortMap: DelegateConfig['effortMap'], tierEffort: Effort, claudeEffort?: Effort): Effort {
  if (!claudeEffort) return tierEffort;
  const mapped = effortMap[claudeEffort];
  return EFFORT_ORDER.indexOf(mapped) > EFFORT_ORDER.indexOf(tierEffort) ? mapped : tierEffort;
}
