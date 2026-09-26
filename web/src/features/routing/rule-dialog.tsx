import { Trash2Icon } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { ConfigForm } from '@/hooks/use-config-form';
import { TIER_ORDER } from '../../../../src/config/config-schema';
import { ListInput } from './list-input';

export const RULE_LIST_FIELDS = [
  ['taskTypes', 'Task types', 'task type', 'review, refactor'],
  ['keywords', 'Keywords in the task', 'keyword', 'migration, auth'],
  ['keywordExemptTaskTypes', 'Task types exempt from keywords', 'except', 'explore'],
  ['flags', 'Flags', 'flag', 'irreversible'],
] as const;

interface RuleDialogProps {
  form: ConfigForm;
  open: boolean;
  /** Index into the form's `rules` array; stays set until the close finishes so the content stays mounted. */
  index: number | null;
  onClose: () => void;
  /** Runs once the close animation ends; the caller clears the index here. */
  onCloseComplete: () => void;
  onRemove: (index: number) => void;
}

// Edits write straight into the config form, so the page's SaveBar saves them with everything else.
// The content stays mounted through the close so Base UI can return focus to the row that opened it.
export function RuleDialog({ form, open, index, onClose, onCloseComplete, onRemove }: RuleDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      onOpenChangeComplete={(nextOpen) => !nextOpen && onCloseComplete()}
    >
      {index !== null && (
        <DialogContent className="rule-dialog gap-5 p-5 sm:max-w-xl sm:p-6">
          <RuleFields form={form} index={index} />
          <DialogFooter className="rule-dialog-footer -mx-5 -mb-5 flex-row items-center justify-between gap-3 border-t border-border px-5 py-3 sm:-mx-6 sm:-mb-6 sm:px-6">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <Trash2Icon aria-hidden="true" />
              Remove rule
            </Button>
            <DialogClose render={<Button type="button" />}>Done</DialogClose>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

function RuleFields({ form, index }: { form: ConfigForm; index: number }) {
  const nameError = form.formState.errors.rules?.[index]?.id?.message;
  return (
    <>
      <DialogHeader>
        <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">Rule {String(index + 1).padStart(2, '0')}</p>
        <DialogTitle className="font-display text-2xl leading-tight font-normal">Edit rule</DialogTitle>
        <DialogDescription className="text-pretty">
          A task that matches any list below is raised to this rule's tier. Changes are kept until you save the page.
        </DialogDescription>
      </DialogHeader>
      <fieldset className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
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
        {RULE_LIST_FIELDS.map(([name, label, , example]) => (
          <Controller
            key={name}
            control={form.control}
            name={`rules.${index}.${name}`}
            render={({ field: listField }) => (
              <Field label={label} htmlFor={`rule-${index}-${name}`} help="Comma-separated">
                <ListInput placeholder={example} value={listField.value} onChange={listField.onChange} />
              </Field>
            )}
          />
        ))}
      </fieldset>
    </>
  );
}
