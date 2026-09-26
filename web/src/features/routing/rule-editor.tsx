import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { SettingsGroup } from '@/components/settings-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TierChip } from '@/components/tier-chip';
import { cn } from '@/lib/utils';
import type { ConfigForm } from '@/hooks/use-config-form';
import { RULE_LIST_FIELDS, RuleDialog } from './rule-dialog';

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
  for (const [name, , tag] of RULE_LIST_FIELDS) {
    const values = rule[name];
    if (values !== undefined && values.length > 0) clauses.push({ tag, values });
  }
  if (clauses.length === 0) return <span className="text-muted-foreground">Matches nothing yet</span>;
  return clauses.map((clause, i) => (
    <span key={clause.tag}>
      {i > 0 && '; '}
      <span className="text-muted-foreground">{clause.tag}</span> <span data-mono>{clause.values.join(', ')}</span>
    </span>
  ));
}

export function RuleEditor({ form }: { form: ConfigForm }) {
  const { fields, append, move, remove } = useFieldArray({ control: form.control, name: 'rules', keyName: 'fieldKey' });
  const watchedRules = useWatch({ control: form.control, name: 'rules' });
  const ruleErrors = form.formState.errors.rules;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function editRule(index: number) {
    setEditingIndex(index);
    setDialogOpen(true);
  }

  function addRule() {
    append({ id: '', taskTypes: [], keywords: [], keywordExemptTaskTypes: [], flags: [], tier: 'flash-low' });
    editRule(fields.length);
  }

  // The removed row has no trigger to refocus, and its index no longer exists: unmount at once.
  function removeRule(index: number) {
    setDialogOpen(false);
    setEditingIndex(null);
    remove(index);
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
            <TableHead className="w-10">#</TableHead>
            <TableHead>Rule</TableHead>
            <TableHead>Matches</TableHead>
            <TableHead>Raises to</TableHead>
            <TableHead className="w-24">
              <span className="sr-only">Order</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field, index) => {
            const rule = watchedRules?.[index] ?? field;
            const hasError = ruleErrors?.[index] !== undefined;
            return (
              <TableRow
                key={field.fieldKey}
                className="rule-editor-row cursor-pointer"
                onClick={() => editRule(index)}
              >
                <TableCell className="font-mono text-muted-foreground tabular-nums">{String(index + 1).padStart(2, '0')}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    className={cn(
                      'rule-editor-name -mx-1 rounded-sm px-1 py-0.5 text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring',
                      hasError && 'text-destructive',
                    )}
                    aria-haspopup="dialog"
                    onClick={(event) => {
                      event.stopPropagation();
                      editRule(index);
                    }}
                  >
                    {rule.id || 'Untitled rule'}
                    {hasError && <span className="sr-only"> (needs fixing)</span>}
                  </button>
                </TableCell>
                <TableCell className="whitespace-normal text-pretty">{matchSummary(rule)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowRightIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
                    <TierChip tier={rule.tier} />
                  </span>
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${rule.id || 'rule'} up`}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUpIcon aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${rule.id || 'rule'} down`}
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDownIcon aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {fields.length === 0 && <p className="py-3 text-sm text-muted-foreground">No rules yet. Every task starts at the tier its caller asks for.</p>}
      <Button type="button" variant="outline" className="mt-4 self-start" onClick={addRule}>
        <PlusIcon aria-hidden="true" />
        Add rule
      </Button>
      <RuleDialog
        form={form}
        open={dialogOpen}
        index={editingIndex}
        onClose={() => setDialogOpen(false)}
        onCloseComplete={() => setEditingIndex(null)}
        onRemove={removeRule}
      />
    </SettingsGroup>
  );
}
