import { Controller } from 'react-hook-form';
import { Field } from '@/components/field';
import { SettingsGroup } from '@/components/settings-group';
import { ToggleChip } from '@/components/toggle-chip';
import { Input } from '@/components/ui/input';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

export function ProviderFields({ form, providerId }: { form: ConfigForm; providerId: string }) {
  const field = (name: string) => `provider-${providerId}-${name}`;

  return (
    <div className="provider-fields flex flex-col gap-4">
      <SettingsGroup title="Connection">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor={field('name')}>
            <Input autoComplete="off" {...form.register(`providers.${providerId}.name`)} />
          </Field>
          <Field label="Base URL" htmlFor={field('base-url')}>
            <Input data-mono autoComplete="off" spellCheck={false} {...form.register(`providers.${providerId}.baseUrl`)} />
          </Field>
          <Field label="Key variable" htmlFor={field('key-variable')}>
            <Input data-mono autoComplete="off" spellCheck={false} {...form.register(`providers.${providerId}.keyVariable`)} />
          </Field>
        </div>
      </SettingsGroup>
    </div>
  );
}

/** The settings a provider rarely needs changed after setup: the efforts it accepts and its repair proxy. */
export function ProviderAdvancedFields({ form, providerId }: { form: ConfigForm; providerId: string }) {
  const field = (name: string) => `provider-${providerId}-${name}`;

  return (
    <>
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
    </>
  );
}
