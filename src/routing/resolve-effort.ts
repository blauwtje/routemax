import { EFFORT_ORDER, type DelegateConfig, type Effort } from '../config/config-schema';

export function resolveEffort(effortMap: DelegateConfig['effortMap'], tierEffort: Effort, claudeEffort?: Effort): Effort {
  if (!claudeEffort) return tierEffort;
  const mapped = effortMap[claudeEffort];
  return EFFORT_ORDER.indexOf(mapped) > EFFORT_ORDER.indexOf(tierEffort) ? mapped : tierEffort;
}

export function fitEffort(effort: Effort, accepted: Effort[]): Effort {
  const rank = (value: Effort) => EFFORT_ORDER.indexOf(value);
  const ascending = [...accepted].sort((left, right) => rank(left) - rank(right));
  return ascending.filter((value) => rank(value) <= rank(effort)).at(-1) ?? ascending[0];
}
