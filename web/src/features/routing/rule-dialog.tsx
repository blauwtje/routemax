import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { Select, type SelectOption } from '@/components/select/select';
import { TextField } from '@/components/text-field/text-field';
import type { ConfigForm } from '@/hooks/use-config-form';
import { TIER_ORDER } from '../../../../src/config/config-schema';
import styles from './rule-dialog.module.css';

export const RULE_LIST_FIELDS = [
  ['taskTypes', 'Task types', 'task type', 'review, refactor'],
  ['keywords', 'Keywords in the task', 'keyword', 'migration, auth'],
  ['keywordExemptTaskTypes', 'Task types exempt from keywords', 'except', 'explore'],
  ['flags', 'Flags', 'flag', 'irreversible'],
] as const;

const TIER_LABELS = { 'flash-low': 'Flash low', 'flash-high': 'Flash high', 'pro-high': 'Pro high', claude: 'Claude' } as const;

export const TIER_OPTIONS: SelectOption[] = TIER_ORDER.map((tier) => ({ value: tier, label: TIER_LABELS[tier], tier }));

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

type ListFieldProps = { label: string; placeholder: string; value: string[] | undefined; onChange: (next: string[]) => void };

// Keeps the raw text so a trailing comma survives typing; the form holds the split list.
function ListField({ label, placeholder, value, onChange }: ListFieldProps) {
  const joined = (value ?? []).join(', ');
  const [text, setText] = useState(joined);
  const [shownJoined, setShownJoined] = useState(joined);
  if (joined !== shownJoined) {
    setShownJoined(joined);
    setText(joined);
  }
  return (
    <TextField
      mono
      label={label}
      description="Comma-separated"
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      value={text}
      onChange={(event) => {
        const next = splitList(event.target.value);
        setText(event.target.value);
        setShownJoined(next.join(', '));
        onChange(next);
      }}
    />
  );
}

type RuleDialogProps = {
  form: ConfigForm;
  open: boolean;
  /** Index into the form's `rules` array. */
  index: number;
  onOpenChange: (open: boolean) => void;
  onRemove: (index: number) => void;
};

// Edits write straight into the config form, so autosave picks them up with everything else.
export function RuleDialog({ form, open, index, onOpenChange, onRemove }: RuleDialogProps) {
  const tierId = `rule-${index}-tier`;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title="Edit rule"
      description="A task that matches any list below is raised to this rule's tier. Changes save as you make them."
      meta={`Rule ${String(index + 1).padStart(2, '0')}`}
      footerStart={
        <Button variant="danger" icon={<Trash2 aria-hidden="true" />} onClick={() => onRemove(index)}>
          Remove rule
        </Button>
      }
      footerEnd={<Button onClick={() => onOpenChange(false)}>Close</Button>}
    >
      <div className={styles.grid}>
        <Controller
          control={form.control}
          name={`rules.${index}.id`}
          render={({ field, fieldState }) => (
            <TextField
              mono
              label="Rule id"
              autoComplete="off"
              spellCheck={false}
              error={fieldState.error?.message}
              name={field.name}
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value)}
              onBlur={field.onBlur}
            />
          )}
        />
        <Controller
          control={form.control}
          name={`rules.${index}.tier`}
          render={({ field }) => (
            <div className={styles.selectField}>
              <label className={styles.label} htmlFor={tierId}>
                Raise to tier
              </label>
              <Select id={tierId} options={TIER_OPTIONS} value={field.value ?? null} onValueChange={field.onChange} />
            </div>
          )}
        />
        {RULE_LIST_FIELDS.map(([name, label, , example]) => (
          <Controller
            key={name}
            control={form.control}
            name={`rules.${index}.${name}`}
            render={({ field }) => <ListField label={label} placeholder={example} value={field.value} onChange={field.onChange} />}
          />
        ))}
      </div>
    </Dialog>
  );
}
