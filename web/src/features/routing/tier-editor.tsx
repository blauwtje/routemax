import { useWatch } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';
import { SELECT_CLASS, TIER_DOTS } from './tier-styles';

const WORKER_TIERS = ['flash-low', 'flash-high', 'pro-high'] as const;

export function TierEditor({ form }: { form: ConfigForm }) {
  const providers = useWatch({ control: form.control, name: 'providers' }) ?? {};
  const tiers = useWatch({ control: form.control, name: 'tiers' });
  const modelsOf = (providerId: string) => (Object.hasOwn(providers, providerId) ? Object.keys(providers[providerId].models) : []);

  return (
    <section aria-labelledby="tier-editor-title" className="tier-editor flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="tier-editor-title" className="font-heading text-lg font-bold tracking-tight">
          Tiers
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          Each worker tier runs on one provider and model. Claude tasks go to the agents below.
        </p>
      </div>
      <div className="tier-editor-card flex flex-col divide-y rounded-xl bg-card px-4 text-card-foreground shadow-(--shadow-card)">
        {WORKER_TIERS.map((tierName) => (
          <div key={tierName} className="tier-editor-row grid gap-3 py-4 md:grid-cols-[8rem_1fr_1fr_8rem] md:items-end">
            <span className="flex items-center gap-2 font-heading font-bold md:h-8">
              <span aria-hidden="true" className={`size-2.5 rounded-full ${TIER_DOTS[tierName]}`} />
              {tierName}
            </span>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`tier-${tierName}-provider`}>Provider</Label>
              <select
                id={`tier-${tierName}-provider`}
                className={SELECT_CLASS}
                {...form.register(`tiers.${tierName}.provider`, {
                  onChange: (event: { target: { value: string } }) =>
                    form.setValue(`tiers.${tierName}.model`, modelsOf(event.target.value)[0] ?? '', { shouldDirty: true }),
                })}
              >
                {Object.entries(providers).map(([providerId, provider]) => (
                  <option key={providerId} value={providerId}>
                    {provider.enabled ? provider.name : `${provider.name} (disabled)`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`tier-${tierName}-model`}>Model</Label>
              <select id={`tier-${tierName}-model`} className={SELECT_CLASS} {...form.register(`tiers.${tierName}.model`)}>
                {modelsOf(tiers?.[tierName]?.provider ?? '').map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`tier-${tierName}-effort`}>Effort</Label>
              <select id={`tier-${tierName}-effort`} className={SELECT_CLASS} {...form.register(`tiers.${tierName}.effort`)}>
                {EFFORT_ORDER.map((effort) => (
                  <option key={effort} value={effort}>
                    {effort}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
