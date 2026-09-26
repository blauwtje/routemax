import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { SettingsGroup } from '@/components/settings-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TierChip } from '@/components/tier-chip';
import { cn } from '@/lib/utils';
import type { ConfigForm } from '@/hooks/use-config-form';
import { TIER_ORDER } from '../../../../src/config/config-schema';
import { ListInput } from './list-input';

const LIST_FIELDS = [
  ['taskTypes', 'Task types', 'task type'],
  ['keywords', 'Keywords in the task', 'keyword'],
  ['keywordExemptTaskTypes', 'Task types exempt from keywords', 'except'],
  ['flags', 'Flags', 'flag'],
] as const;

type RuleValues = {
  id: string;
  tier: string;
  taskTypes?: string[];
  keywords?: string[];
  keywordExemptTaskTypes?: string[];
  flags?: string[];
};

// Match summary: one clause per non-empty list field, its values in mono, joined with "; ".
function matchSummary(rule: RuleValues | undefined) {
  if (rule === undefined) return null;
  const clauses: { tag: string; values: string[] }[] = [];
  for (const [name, , tag] of LIST_FIELDS) {
    const values = rule[name];
    if (values !== undefined && values.length > 0) clauses.push({ tag, values });
  }
  if (clauses.length === 0) return <span className="text-muted-foreground">Matches nothing yet</span>;
  return clauses.map((clause, i) => (
    <span key={clause.tag}>
      {i > 0 && '; '}
      {clause.tag} <span data-mono>{clause.values.join(', ')}</span>
    </span>
  ));
}

export function RuleEditor({ form }: { form: ConfigForm }) {
  const { fields, append, move, remove } = useFieldArray({ control: form.control, name: 'rules', keyName: 'fieldKey' });
  const watchedRules = useWatch({ control: form.control, name: 'rules' });
  const ruleErrors = form.formState.errors.rules;
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const previousLength = useRef(fields.length);

  // A newly appended rule opens its own editor so its required fields are reachable immediately.
  useEffect(() => {
    if (fields.length > previousLength.current) {
      const last = fields[fields.length - 1];
      setOpenKeys((previous) => new Set(previous).add(last.fieldKey));
    }
    previousLength.current = fields.length;
  }, [fields]);

  function toggle(fieldKey: string) {
    setOpenKeys((previous) => {
      const next = new Set(previous);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  }

  return (
    <SettingsGroup
      className="border-t-0 pt-0"
      title="Rules"
      description="A task goes to the highest tier among the rules it matches. When two rules raise it to the same tier, the upper one is named in History."
    >
      <Table className="rule-editor-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Matches</TableHead>
            <TableHead>Raises to</TableHead>
            <TableHead className="w-16">Edit</TableHead>
            <TableHead className="w-28">Reorder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field, index) => {
            const rule = watchedRules?.[index] ?? field;
            const nameError = ruleErrors?.[index]?.id?.message;
            const hasError = ruleErrors?.[index] !== undefined;
            const open = openKeys.has(field.fieldKey) || hasError;
            const panelId = `rule-${index}-panel`;
            return (
              <Fragment key={field.fieldKey}>
                <TableRow className="rule-editor-row">
                  <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className={cn('font-medium', hasError && 'text-destructive')}>{rule.id || 'Untitled rule'}</TableCell>
                  <TableCell className="whitespace-normal text-pretty">{matchSummary(rule)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <ArrowRightIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
                      <TierChip tier={rule.tier} />
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => toggle(field.fieldKey)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Move rule up"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUpIcon aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Move rule down"
                        disabled={index === fields.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDownIcon aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove rule"
                        onClick={() => remove(index)}
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow className="rule-editor-panel-row">
                    <TableCell colSpan={6} id={panelId}>
                      <fieldset className="grid gap-x-4 gap-y-3 py-2 md:grid-cols-2">
                        <legend className="sr-only">Rule {index + 1} fields</legend>
                        <Field label="Name" htmlFor={`rule-${index}-id`} error={nameError}>
                          <Input autoComplete="off" spellCheck={false} {...form.register(`rules.${index}.id`)} />
                        </Field>
                        <Field label="Raise to tier" htmlFor={`rule-${index}-tier`}>
                          <NativeSelect {...form.register(`rules.${index}.tier`)}>
                            {TIER_ORDER.map((tier) => (
                              <option key={tier} value={tier}>
                                {tier}
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                        {LIST_FIELDS.map(([name, label]) => (
                          <Controller
                            key={name}
                            control={form.control}
                            name={`rules.${index}.${name}`}
                            render={({ field: listField }) => (
                              <Field label={label} htmlFor={`rule-${index}-${name}`} help="Comma-separated">
                                <ListInput value={listField.value} onChange={listField.onChange} />
                              </Field>
                            )}
                          />
                        ))}
                      </fieldset>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <Button
        type="button"
        variant="outline"
        className="mt-4 self-start"
        onClick={() => append({ id: '', taskTypes: [], keywords: [], keywordExemptTaskTypes: [], flags: [], tier: 'flash-low' })}
      >
        <PlusIcon aria-hidden="true" />
        Add rule
      </Button>
    </SettingsGroup>
  );
}
