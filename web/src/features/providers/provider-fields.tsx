import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

const TEXT_FIELDS = [
  ['name', 'Name'],
  ['baseUrl', 'Base URL'],
  ['keychainService', 'Keychain service'],
] as const;

export function ProviderFields({ form, providerId }: { form: ConfigForm; providerId: string }) {
  const field = (name: string) => `provider-${providerId}-${name}`;
  return (
    <div className="provider-fields flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={field('title')} className="font-heading text-lg font-bold tracking-tight">
          {providerId}
        </h2>
        <Controller
          control={form.control}
          name={`providers.${providerId}.enabled`}
          render={({ field: enabled }) => (
            <Label className="flex items-center gap-2 text-sm">
              <Switch checked={enabled.value} onCheckedChange={(checked) => enabled.onChange(checked)} />
              <span className={enabled.value ? 'text-foreground' : 'text-muted-foreground'}>{enabled.value ? 'Enabled' : 'Disabled: no tier can use it'}</span>
            </Label>
          )}
        />
      </div>
      <div className="provider-fields-grid grid gap-3 md:grid-cols-3">
        {TEXT_FIELDS.map(([name, label]) => (
          <div key={name} className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={field(name)}>{label}</Label>
            <Input id={field(name)} autoComplete="off" spellCheck={false} {...form.register(`providers.${providerId}.${name}`)} />
          </div>
        ))}
      </div>
      <Controller
        control={form.control}
        name={`providers.${providerId}.efforts`}
        render={({ field: efforts }) => (
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <legend className="mb-2 text-sm font-medium">Efforts it accepts</legend>
            {EFFORT_ORDER.map((effort) => (
              <label key={effort} className="flex min-h-6 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={efforts.value.includes(effort)}
                  onChange={(event) => efforts.onChange(event.target.checked ? EFFORT_ORDER.filter((kept) => kept === effort || efforts.value.includes(kept)) : efforts.value.filter((kept) => kept !== effort))}
                />
                {effort}
              </label>
            ))}
          </fieldset>
        )}
      />
      <Controller
        control={form.control}
        name={`providers.${providerId}.repairProxy`}
        render={({ field: proxy }) =>
          proxy.value === null ? (
            <p className="border-t border-border pt-4 text-sm text-muted-foreground">No repair proxy.</p>
          ) : (
            <div className="provider-fields-grid grid gap-3 border-t border-border pt-4 md:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={field('proxy-port')}>Repair proxy port</Label>
                <Input id={field('proxy-port')} type="number" className="tabular-nums" value={Number.isNaN(proxy.value.port) ? '' : proxy.value.port} onChange={(event) => proxy.onChange({ ...proxy.value, port: event.target.valueAsNumber })} />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={field('proxy-log')}>Proxy log</Label>
                <Input id={field('proxy-log')} spellCheck={false} value={proxy.value.logPath} onChange={(event) => proxy.onChange({ ...proxy.value, logPath: event.target.value })} />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={field('proxy-telemetry')}>Proxy telemetry</Label>
                <Input id={field('proxy-telemetry')} spellCheck={false} value={proxy.value.telemetryPath} onChange={(event) => proxy.onChange({ ...proxy.value, telemetryPath: event.target.value })} />
              </div>
            </div>
          )
        }
      />
    </div>
  );
}
