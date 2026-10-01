import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { AdvancedSection } from '@/components/advanced-section';
import { SettingsGroup } from '@/components/settings-group';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ConfigForm } from '@/hooks/use-config-form';
import type { ProviderTestResult } from '@/lib/api-types';
import { ProviderAdvancedFields, ProviderFields } from './provider-fields';
import { ProviderModels } from './provider-models';
import { ProviderTestPanel } from './provider-test-panel';

interface ProviderSheetProps {
  form: ConfigForm;
  providerId: string | null;
  keyPresent: boolean | undefined;
  lastTest: ProviderTestResult | undefined;
  onOpenChange: (open: boolean) => void;
  onTested: () => void;
}

/**
 * The editor one provider row opens. Edits land in the page's form like any other field, so they
 * are saved, or restored, from the page's save bar once the sheet closes.
 */
export function ProviderSheet({ form, providerId, keyPresent, lastTest, onOpenChange, onTested }: ProviderSheetProps) {
  // The body keeps showing the last opened provider while the sheet slides out, instead of emptying mid-animation.
  const [shownProviderId, setShownProviderId] = useState(providerId);
  if (providerId !== null && providerId !== shownProviderId) setShownProviderId(providerId);

  return (
    <Sheet open={providerId !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="provider-sheet gap-0 border-border bg-surface-1 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        {shownProviderId !== null && <ProviderSheetBody form={form} providerId={shownProviderId} keyPresent={keyPresent} lastTest={lastTest} onTested={onTested} />}
      </SheetContent>
    </Sheet>
  );
}

function ProviderSheetBody({ form, providerId, keyPresent, lastTest, onTested }: Omit<ProviderSheetProps, 'providerId' | 'onOpenChange'> & { providerId: string }) {
  const name = useWatch({ control: form.control, name: `providers.${providerId}.name` });
  const keyVariable = useWatch({ control: form.control, name: `providers.${providerId}.keyVariable` });
  const models = useWatch({ control: form.control, name: `providers.${providerId}.models` }) ?? {};

  return (
    <>
      <SheetHeader className="provider-sheet-header gap-1 border-b border-border px-5 pt-6 pb-4 pr-14 sm:px-6">
        <SheetTitle className="font-display text-[32px] leading-tight font-normal text-balance">{name || providerId}</SheetTitle>
        <SheetDescription className="font-mono text-[13px]">{providerId}</SheetDescription>
      </SheetHeader>
      <div className="provider-sheet-body flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        <ProviderFields form={form} providerId={providerId} />
        <ProviderModels form={form} providerId={providerId} />
        <SettingsGroup title="API key">
          <p className="provider-key-status text-sm font-medium">{keyPresent === undefined ? 'Checking the key' : keyPresent ? 'Key present' : 'Key missing'}</p>
          <p className="text-sm text-pretty text-muted-foreground">
            Add <span className="font-mono">{keyVariable || 'a key variable'}</span> to ~/.config/routemax/keys.env
          </p>
        </SettingsGroup>
        <ProviderTestPanel providerId={providerId} models={Object.keys(models)} result={lastTest} dirty={form.formState.isDirty} onTested={onTested} />
        <AdvancedSection summary="Efforts it accepts and the repair proxy">
          <ProviderAdvancedFields form={form} providerId={providerId} />
        </AdvancedSection>
      </div>
      <SheetFooter className="provider-sheet-footer flex-row items-center justify-between gap-4 border-t border-border px-5 py-3 sm:px-6">
        <p className="text-sm text-pretty text-muted-foreground">Changes save from the page's save bar.</p>
        <SheetClose render={<Button type="button" variant="outline" />}>Done</SheetClose>
      </SheetFooter>
    </>
  );
}
