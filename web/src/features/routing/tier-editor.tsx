import { useWatch } from 'react-hook-form';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SettingsGroup } from '@/components/settings-group';
import { TierChip } from '@/components/tier-chip';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

const WORKER_TIERS = ['flash-low', 'flash-high', 'pro-high'] as const;

export function TierEditor({ form }: { form: ConfigForm }) {
  const providers = useWatch({ control: form.control, name: 'providers' }) ?? {};
  const tiers = useWatch({ control: form.control, name: 'tiers' });
  const modelsOf = (providerId: string) => (Object.hasOwn(providers, providerId) ? Object.keys(providers[providerId].models) : []);

  return (
    <SettingsGroup className="border-t-0 pt-0" title="Tiers" description="Where each tier sends a task. Tasks that end on Claude use the Claude agents under Advanced.">
      <Table className="tier-editor-table">
        <TableHeader>
          <TableRow>
            <TableHead>Tier</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Effort</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {WORKER_TIERS.map((tierName) => (
            <TableRow key={tierName}>
              <TableCell>
                <TierChip tier={tierName} />
              </TableCell>
              <TableCell>
                <NativeSelect
                  aria-label={`Provider for ${tierName}`}
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
                </NativeSelect>
              </TableCell>
              <TableCell>
                <NativeSelect aria-label={`Model for ${tierName}`} {...form.register(`tiers.${tierName}.model`)}>
                  {modelsOf(tiers?.[tierName]?.provider ?? '').map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </NativeSelect>
              </TableCell>
              <TableCell>
                <NativeSelect aria-label={`Effort for ${tierName}`} {...form.register(`tiers.${tierName}.effort`)}>
                  {EFFORT_ORDER.map((effort) => (
                    <option key={effort} value={effort}>
                      {effort}
                    </option>
                  ))}
                </NativeSelect>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsGroup>
  );
}
