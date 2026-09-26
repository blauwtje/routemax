import { Controller, useWatch } from 'react-hook-form';
import { Field } from '@/components/field';
import { SettingsGroup } from '@/components/settings-group';
import { StatusIndicator } from '@/components/status-indicator';
import { ToggleChip } from '@/components/toggle-chip';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

interface ProviderSummaryProps {
  form: ConfigForm;
  providerId: string;
  keyPresent: boolean | undefined;
  modelCount: number;
}

// The shared StatusIndicator (web/src/components/status-indicator.tsx) renders a dot + word and
// now covers this header's "enabled"/"disabled" and "present"/"absent" states directly.
export function ProviderSummary({ form, providerId, keyPresent, modelCount }: ProviderSummaryProps) {
  const name = useWatch({ control: form.control, name: `providers.${providerId}.name` });
  return (
    <summary
      id={`provider-${providerId}-title`}
      className="provider-summary flex cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6"
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="text-[17px] font-semibold text-foreground">{name || providerId}</span>
        <span className="font-mono text-sm text-muted-foreground">{providerId}</span>
      </span>
      <span className="flex flex-wrap items-center gap-4 text-sm">
        <Controller
          control={form.control}
          name={`providers.${providerId}.enabled`}
          render={({ field: enabled }) => (
            <span className="flex items-center gap-2">
              <StatusIndicator value={enabled.value ? 'enabled' : 'disabled'} />
              <Switch
                checked={enabled.value}
                onCheckedChange={(checked) => enabled.onChange(checked)}
                onClick={(event) => event.stopPropagation()}
                aria-label={`${name || providerId} enabled`}
              />
            </span>
          )}
        />
        {keyPresent === undefined ? (
          <span className="font-medium text-muted-foreground">Key checking</span>
        ) : (
          <StatusIndicator value={keyPresent ? 'present' : 'absent'} label={keyPresent ? 'Key present' : 'Key absent'} />
        )}
        <span className="text-muted-foreground">
          {modelCount} model{modelCount === 1 ? '' : 's'}
        </span>
      </span>
    </summary>
  );
}

export function ProviderFields({ form, providerId }: { form: ConfigForm; providerId: string }) {
  const field = (name: string) => `provider-${providerId}-${name}`;

  return (
    <div className="provider-fields flex flex-col gap-4">
      <SettingsGroup title="Connection">
        <div className="grid gap-3 md:grid-cols-[minmax(140px,1fr)_minmax(240px,2fr)_minmax(240px,2fr)]">
          <Field label="Name" htmlFor={field('name')}>
            <Input autoComplete="off" {...form.register(`providers.${providerId}.name`)} />
          </Field>
          <Field label="Base URL" htmlFor={field('base-url')}>
            <Input data-mono autoComplete="off" spellCheck={false} {...form.register(`providers.${providerId}.baseUrl`)} />
          </Field>
          <Field label="Keychain service" htmlFor={field('keychain')}>
            <Input data-mono autoComplete="off" spellCheck={false} {...form.register(`providers.${providerId}.keychainService`)} />
          </Field>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Efforts">
        <Controller
          control={form.control}
          name={`providers.${providerId}.efforts`}
          render={({ field: efforts }) => (
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">Efforts it accepts</legend>
              {EFFORT_ORDER.map((effort) => (
                <ToggleChip
                  key={effort}
                  label={effort}
                  checked={efforts.value.includes(effort)}
                  onChange={(event) =>
                    efforts.onChange(
                      event.target.checked
                        ? EFFORT_ORDER.filter((kept) => kept === effort || efforts.value.includes(kept))
                        : efforts.value.filter((kept) => kept !== effort),
                    )
                  }
                />
              ))}
            </fieldset>
          )}
        />
      </SettingsGroup>

      <SettingsGroup title="Repair proxy">
        <Controller
          control={form.control}
          name={`providers.${providerId}.repairProxy`}
          render={({ field: proxy }) =>
            proxy.value === null ? (
              <p className="text-sm text-muted-foreground">No repair proxy.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Port" htmlFor={field('proxy-port')}>
                  <Input
                    data-mono
                    type="number"
                    value={Number.isNaN(proxy.value.port) ? '' : proxy.value.port}
                    onChange={(event) => proxy.onChange({ ...proxy.value, port: event.target.valueAsNumber })}
                  />
                </Field>
                <Field label="Proxy log" htmlFor={field('proxy-log')}>
                  <Input data-mono spellCheck={false} value={proxy.value.logPath} onChange={(event) => proxy.onChange({ ...proxy.value, logPath: event.target.value })} />
                </Field>
                <Field label="Proxy telemetry" htmlFor={field('proxy-telemetry')}>
                  <Input data-mono spellCheck={false} value={proxy.value.telemetryPath} onChange={(event) => proxy.onChange({ ...proxy.value, telemetryPath: event.target.value })} />
                </Field>
              </div>
            )
          }
        />
      </SettingsGroup>
    </div>
  );
}
