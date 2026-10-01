import { Select as BaseSelect } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import { TierDot, type TierId } from '../badge/badge';
import styles from './select.module.css';

export type SelectOption = { value: string; label: string; tier?: TierId; disabled?: boolean };

type SelectProps = {
  options: SelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Shown in the open list when options is empty. */
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Martian Mono for model ids and efforts. */
  mono?: boolean;
  'aria-label'?: string;
  id?: string;
  className?: string;
};

export function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Choose',
  emptyText = 'Nothing to choose yet.',
  disabled,
  invalid,
  mono,
  id,
  className,
  'aria-label': ariaLabel,
}: SelectProps) {
  const selected = options.find((option) => option.value === value);
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange(next);
      }}
      disabled={disabled}
    >
      <BaseSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        data-mono={mono || undefined}
        className={[styles.trigger, className].filter(Boolean).join(' ')}
      >
        {selected?.tier ? <TierDot tier={selected.tier} /> : null}
        <span className={styles.value} data-placeholder={selected ? undefined : ''}>
          {selected ? selected.label : placeholder}
        </span>
        <BaseSelect.Icon className={styles.icon}>
          <ChevronDown aria-hidden="true" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className={styles.positioner} sideOffset={6} alignItemWithTrigger={false}>
          <BaseSelect.Popup className={styles.popup} data-mono={mono || undefined}>
            <BaseSelect.List className={styles.list}>
              {options.length === 0 ? <p className={styles.empty}>{emptyText}</p> : null}
              {options.map((option) => (
                <BaseSelect.Item key={option.value} value={option.value} label={option.label} disabled={option.disabled} className={styles.item}>
                  {option.tier ? <TierDot tier={option.tier} /> : null}
                  <BaseSelect.ItemText className={styles.itemText}>{option.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className={styles.check}>
                    <Check aria-hidden="true" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
