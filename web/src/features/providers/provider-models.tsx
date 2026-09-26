import { useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Field } from '@/components/field';
import { SettingsGroup } from '@/components/settings-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ConfigForm } from '@/hooks/use-config-form';

const PRICE_FIELDS = [
  ['inputUsd', 'Input'],
  ['cacheHitUsd', 'Cache hit'],
  ['outputUsd', 'Output'],
] as const;

export function ProviderModels({ form, providerId }: { form: ConfigForm; providerId: string }) {
  const [newModel, setNewModel] = useState('');
  return (
    <Controller
      control={form.control}
      name={`providers.${providerId}.models`}
      render={({ field }) => (
        <SettingsGroup
          title={
            <>
              Models and prices <span className="font-normal text-muted-foreground">(USD per 1M tokens)</span>
            </>
          }
        >
          <div className="provider-models flex min-w-0 flex-col gap-3">
            {Object.keys(field.value ?? {}).length === 0 ? (
              <p className="text-sm text-muted-foreground">No models yet.</p>
            ) : (
              <>
                {/* >=768px: a real table, the panel is wide enough for 5 columns with no scroll. */}
                <div role="region" aria-label="Models and prices" className="hidden overflow-hidden rounded-md border border-border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead>Input</TableHead>
                        <TableHead>Cache hit</TableHead>
                        <TableHead>Output</TableHead>
                        <TableHead className="sr-only">Remove</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(field.value ?? {}).map(([model, price]) => (
                        <TableRow key={model}>
                          <TableCell className="font-mono text-sm">{model}</TableCell>
                          {PRICE_FIELDS.map(([priceField, label]) => (
                            <TableCell key={priceField} className="min-w-32">
                              <Field
                                label={<span className="sr-only">{`${model} ${label} price`}</span>}
                                htmlFor={`model-${providerId}-${model}-${priceField}`}
                                prefix="$"
                              >
                                <Input
                                  data-mono
                                  type="number"
                                  step="any"
                                  value={Number.isNaN(price[priceField]) ? '' : price[priceField]}
                                  onChange={(event) => field.onChange({ ...field.value, [model]: { ...price, [priceField]: event.target.valueAsNumber } })}
                                />
                              </Field>
                            </TableCell>
                          ))}
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Remove model ${model}`}
                              onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== model)))}
                            >
                              <Trash2Icon aria-hidden="true" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* <768px: one card per model, prices stacked in a grid instead of a scrolling table. */}
                <ul aria-label="Models and prices" className="flex flex-col gap-3 md:hidden">
                  {Object.entries(field.value ?? {}).map(([model, price]) => (
                    <li key={model} className="rounded-md border border-border bg-surface-2/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm break-all">{model}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove model ${model}`}
                          onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== model)))}
                        >
                          <Trash2Icon aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {PRICE_FIELDS.map(([priceField, label]) => (
                          <Field key={priceField} label={label} htmlFor={`model-${providerId}-${model}-${priceField}-sm`} prefix="$">
                            <Input
                              data-mono
                              type="number"
                              step="any"
                              value={Number.isNaN(price[priceField]) ? '' : price[priceField]}
                              onChange={(event) => field.onChange({ ...field.value, [model]: { ...price, [priceField]: event.target.valueAsNumber } })}
                            />
                          </Field>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="provider-models-add flex flex-col gap-2">
              <div className="flex w-full min-w-0 flex-col gap-1.5">
                <Label htmlFor={`model-${providerId}-new`}>New model</Label>
                <Input data-mono id={`model-${providerId}-new`} autoComplete="off" spellCheck={false} value={newModel} onChange={(event) => setNewModel(event.target.value.trim())} />
              </div>
              <Button
                type="button"
                variant="outline"
                className="self-start"
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
        </SettingsGroup>
      )}
    />
  );
}
