import { ChevronRightIcon } from 'lucide-react';
import { Controller, useWatch } from 'react-hook-form';
import { StatusIndicator } from '@/components/status-indicator';
import { Switch } from '@/components/ui/switch';
import type { ConfigForm } from '@/hooks/use-config-form';
import type { ProviderTestResult } from '@/lib/api-types';
import { formatTime } from '@/lib/format';

interface ProviderRowProps {
  form: ConfigForm;
  providerId: string;
  keyPresent: boolean | undefined;
  lastTest: ProviderTestResult | undefined;
  modelCount: number;
  onOpen: (providerId: string) => void;
}

/**
 * One provider as one line: the name opens the edit sheet, while the on/off switch sits beside it
 * rather than inside it, so toggling a provider never opens the sheet and no control nests in another.
 */
export function ProviderRow({ form, providerId, keyPresent, lastTest, modelCount, onOpen }: ProviderRowProps) {
  const name = useWatch({ control: form.control, name: `providers.${providerId}.name` });
  const label = name || providerId;

  return (
    <li className="provider-row group/row relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-150 hover:bg-[oklch(1_0_0/0.03)] sm:px-5 md:grid-cols-(--provider-row-columns)">
      <button
        type="button"
        onClick={() => onOpen(providerId)}
        aria-haspopup="dialog"
        className="provider-row-open flex min-h-11 min-w-0 items-center gap-3 rounded-md text-left outline-none select-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold text-foreground">{label}</span>
          <span className="truncate font-mono text-[13px] text-muted-foreground">
            {providerId} · {modelCount} model{modelCount === 1 ? '' : 's'}
          </span>
        </span>
        <ChevronRightIcon
          aria-hidden="true"
          className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover/row:translate-x-0.5 md:hidden"
        />
      </button>

      <span className="provider-row-key col-start-1 row-start-2 text-sm md:col-start-auto md:row-start-auto">
        {keyPresent === undefined ? (
          <span className="font-medium text-muted-foreground">Key checking</span>
        ) : (
          <StatusIndicator value={keyPresent ? 'present' : 'absent'} label={keyPresent ? 'Key present' : 'Key absent'} />
        )}
      </span>

      <span className="provider-row-test col-start-1 row-start-3 flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm md:col-start-auto md:row-start-auto">
        {lastTest === undefined ? (
          <span className="text-muted-foreground">Never tested</span>
        ) : (
          <>
            <StatusIndicator value={lastTest.passed ? 'passed' : 'failed'} label={lastTest.passed ? 'Test passed' : 'Test failed'} />
            <span className="font-mono text-[13px] text-muted-foreground tabular-nums">{formatTime(lastTest.testedAt)}</span>
          </>
        )}
      </span>

      <Controller
        control={form.control}
        name={`providers.${providerId}.enabled`}
        render={({ field: enabled }) => (
          <span className="relative z-10 col-start-2 row-span-3 row-start-1 flex items-center gap-2 justify-self-end md:row-span-1 md:col-start-auto">
            <span className="hidden text-sm text-muted-foreground sm:inline">{enabled.value ? 'On' : 'Off'}</span>
            <Switch checked={enabled.value} onCheckedChange={(checked) => enabled.onChange(checked)} aria-label={`${label} enabled`} />
            <ChevronRightIcon
              aria-hidden="true"
              className="hidden size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover/row:translate-x-0.5 md:block"
            />
          </span>
        )}
      />
    </li>
  );
}
