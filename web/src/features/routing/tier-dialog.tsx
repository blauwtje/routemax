import { useWatch } from 'react-hook-form';
import { Badge, StatusDot } from '@/components/badge/badge';
import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { Select } from '@/components/select/select';
import type { ConfigForm } from '@/hooks/use-config-form';
import type { ProviderTestsResponse } from '@/lib/api-types';
import { EFFORT_ORDER, type Effort } from '../../../../src/config/config-schema';
import { tierWarnings } from './tier-warnings';
import styles from './tier-dialog.module.css';

export const WORKER_TIERS = ['flash-low', 'flash-high', 'pro-high'] as const;
export type WorkerTierName = (typeof WORKER_TIERS)[number];

type TierDialogProps = {
  form: ConfigForm;
  tier: WorkerTierName;
  tests: ProviderTestsResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TierDialog({ form, tier: tierName, tests, open, onOpenChange }: TierDialogProps) {
  const providers = useWatch({ control: form.control, name: 'providers' }) ?? {};
  const tier = useWatch({ control: form.control, name: `tiers.${tierName}` });
  const providerOf = (providerId: string) => (Object.hasOwn(providers, providerId) ? providers[providerId] : undefined);
  const modelsOf = (providerId: string) => Object.keys(providerOf(providerId)?.models ?? {});
  const effortsOf = (providerId: string): readonly Effort[] => providerOf(providerId)?.efforts ?? EFFORT_ORDER;

  const providerOptions = Object.entries(providers).map(([providerId, provider]) => ({
    value: providerId,
    label: provider.enabled ? provider.name : `${provider.name} (disabled)`,
  }));
  const modelOptions = modelsOf(tier?.provider ?? '').map((model) => ({ value: model, label: model }));
  const effortOptions = effortsOf(tier?.provider ?? '').map((effort) => ({ value: effort, label: effort }));
  const warnings = tier !== undefined && tests !== null ? tierWarnings({ [tierName]: tier }, tests) : [];

  // Changing the provider resets the model to its first one, and the effort to one it supports.
  function changeProvider(providerId: string) {
    if (tier === undefined) return;
    const supported = effortsOf(providerId);
    form.setValue(
      `tiers.${tierName}`,
      { provider: providerId, model: modelsOf(providerId)[0] ?? '', effort: supported.includes(tier.effort) ? tier.effort : supported[0] },
      { shouldDirty: true },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={<Badge tier={tierName}>{tierName}</Badge>}
      description="Where this tier sends a task. Changes save as you make them."
      meta="Tier"
      footerEnd={
        <Button type="button" variant="primary" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`tier-${tierName}-provider`}>
            Provider
          </label>
          <Select
            id={`tier-${tierName}-provider`}
            options={providerOptions}
            value={tier?.provider ?? null}
            onValueChange={changeProvider}
            emptyText="No providers yet. Add one under Providers."
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`tier-${tierName}-model`}>
            Model
          </label>
          <Select
            id={`tier-${tierName}-model`}
            mono
            options={modelOptions}
            value={tier?.model ?? null}
            onValueChange={(model) => form.setValue(`tiers.${tierName}.model`, model, { shouldDirty: true })}
            emptyText="This provider lists no models yet."
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`tier-${tierName}-effort`}>
            Effort
          </label>
          <Select
            id={`tier-${tierName}-effort`}
            options={effortOptions}
            value={tier?.effort ?? null}
            onValueChange={(effort) => form.setValue(`tiers.${tierName}.effort`, effort as Effort, { shouldDirty: true })}
          />
        </div>
        {warnings.map((warning) => (
          <p key={warning} className={styles.warning}>
            <StatusDot tone="warn" />
            <span>{warning}</span>
          </p>
        ))}
      </div>
    </Dialog>
  );
}
