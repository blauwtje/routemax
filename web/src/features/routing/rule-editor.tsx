import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Controller, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import { TIER_ORDER } from '../../../../src/config/config-schema';
import { ListInput } from './list-input';

const LIST_FIELDS = [
  ['taskTypes', 'Task types'],
  ['keywords', 'Keywords in the task'],
  ['keywordExemptTaskTypes', 'Task types exempt from keywords'],
  ['flags', 'Flags'],
] as const;

export function RuleEditor({ form }: { form: ConfigForm }) {
  const { fields, append, move, remove } = useFieldArray({ control: form.control, name: 'rules', keyName: 'fieldKey' });

  return (
    <section aria-labelledby="rule-editor-title" className="rule-editor flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="rule-editor-title" className="font-heading text-lg font-bold tracking-tight">
          Rules
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          A task goes to the highest tier among the rules it matches. When two rules raise it to the same tier, the upper one is named in History.
        </p>
      </div>
      {fields.map((field, index) => (
        <fieldset
          key={field.fieldKey}
          className="rule-editor-rule grid gap-x-4 gap-y-3 rounded-xl bg-card p-4 pt-3 text-card-foreground shadow-(--shadow-card) md:grid-cols-2"
        >
          <legend className="float-left mb-1 flex w-full items-center gap-2 text-sm font-medium text-muted-foreground md:col-span-2">
            <span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-primary/15 font-heading text-xs font-bold text-primary tabular-nums">{index + 1}</span>
            Rule {index + 1}
          </legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`rule-${index}-id`}>Name</Label>
            <Input id={`rule-${index}-id`} autoComplete="off" spellCheck={false} {...form.register(`rules.${index}.id`)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`rule-${index}-tier`}>Raise to tier</Label>
            <select
              id={`rule-${index}-tier`}
              className="rule-editor-select h-8 w-full rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...form.register(`rules.${index}.tier`)}
            >
              {TIER_ORDER.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>
          {LIST_FIELDS.map(([name, label]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <Label htmlFor={`rule-${index}-${name}`}>{label}</Label>
              <Controller
                control={form.control}
                name={`rules.${index}.${name}`}
                render={({ field: listField }) => <ListInput id={`rule-${index}-${name}`} value={listField.value} onChange={listField.onChange} />}
              />
            </div>
          ))}
          <div className="rule-editor-actions flex flex-wrap gap-2 border-t pt-3 md:col-span-2">
            <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => move(index, index - 1)}>
              <ArrowUpIcon aria-hidden="true" />
              Move up
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>
              <ArrowDownIcon aria-hidden="true" />
              Move down
            </Button>
            <Button type="button" variant="ghost" size="sm" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => remove(index)}>
              <Trash2Icon aria-hidden="true" />
              Remove rule
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => append({ id: '', taskTypes: [], keywords: [], keywordExemptTaskTypes: [], flags: [], tier: 'flash-low' })}
      >
        <PlusIcon aria-hidden="true" />
        Add rule
      </Button>
    </section>
  );
}
