import { useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';

const PRICE_FIELDS = [
  ['inputUsd', 'Input USD'],
  ['cacheHitUsd', 'Cache hit USD'],
  ['outputUsd', 'Output USD'],
] as const;

export function ProviderModels({ form, providerId }: { form: ConfigForm; providerId: string }) {
  const [newModel, setNewModel] = useState('');
  return (
    <Controller
      control={form.control}
      name={`providers.${providerId}.models`}
      render={({ field }) => (
        <div className="provider-models flex flex-col gap-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Models and prices</h3>
          {Object.keys(field.value ?? {}).length === 0 && <p className="text-sm text-muted-foreground">No models yet.</p>}
          <div className="flex flex-col divide-y divide-border">
            {Object.entries(field.value ?? {}).map(([model, price]) => (
              <div key={model} className="provider-models-row grid grid-cols-3 items-end gap-3 py-3 md:grid-cols-[12rem_1fr_1fr_1fr_auto]">
                <span className="col-span-2 min-w-0 self-center font-medium break-words md:col-span-1 md:self-end md:pb-1.5">{model}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-self-end text-muted-foreground hover:text-destructive md:order-last"
                  aria-label={`Remove model ${model}`}
                  onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== model)))}
                >
                  <Trash2Icon aria-hidden="true" />
                  Remove model
                </Button>
                {PRICE_FIELDS.map(([priceField, label]) => (
                  <div key={priceField} className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={`model-${providerId}-${model}-${priceField}`}>{label}</Label>
                    <Input
                      id={`model-${providerId}-${model}-${priceField}`}
                      type="number"
                      step="any"
                      className="tabular-nums"
                      value={Number.isNaN(price[priceField]) ? '' : price[priceField]}
                      onChange={(event) => field.onChange({ ...field.value, [model]: { ...price, [priceField]: event.target.valueAsNumber } })}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="provider-models-add flex items-end gap-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor={`model-${providerId}-new`}>New model</Label>
              <Input id={`model-${providerId}-new`} autoComplete="off" spellCheck={false} value={newModel} onChange={(event) => setNewModel(event.target.value.trim())} />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={newModel === '' || Object.hasOwn(field.value ?? {}, newModel)}
              onClick={() => {
                field.onChange({ ...field.value, [newModel]: { inputUsd: Number.NaN, cacheHitUsd: Number.NaN, outputUsd: Number.NaN } });
                setNewModel('');
              }}
            >
              <PlusIcon aria-hidden="true" />
              Add model
            </Button>
          </div>
        </div>
      )}
    />
  );
}
