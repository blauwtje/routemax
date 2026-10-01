import { Field } from '@base-ui/react/field';
import { CircleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import styles from './text-field.module.css';

type FieldProps = Omit<ComponentProps<'input'>, 'prefix' | 'className' | 'size'>;

type TextFieldProps = FieldProps & {
  label: ReactNode;
  hideLabel?: boolean;
  description?: ReactNode;
  /** Error text; its presence marks the field invalid. */
  error?: ReactNode;
  /** Affix inside the frame, for example "$" or "ms". */
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Trailing control such as a copy button. */
  adornment?: ReactNode;
  /** Martian Mono for ids, commands, paths and numbers. */
  mono?: boolean;
  multiline?: boolean;
  rows?: number;
  className?: string;
};

export function TextField({
  label,
  hideLabel,
  description,
  error,
  prefix,
  suffix,
  adornment,
  mono,
  multiline,
  rows = 3,
  disabled,
  className,
  ...inputProps
}: TextFieldProps) {
  const invalid = Boolean(error);
  return (
    <Field.Root className={[styles.root, className].filter(Boolean).join(' ')} disabled={disabled} invalid={invalid}>
      <Field.Label className={hideLabel ? 'visually-hidden' : styles.label}>{label}</Field.Label>
      <div className={styles.frame} data-invalid={invalid || undefined} data-disabled={disabled || undefined} data-multiline={multiline || undefined}>
        {prefix ? <span className={styles.affix}>{prefix}</span> : null}
        <Field.Control
          {...inputProps}
          render={multiline ? <textarea rows={rows} /> : undefined}
          className={styles.control}
          data-mono={mono || undefined}
        />
        {suffix ? <span className={styles.affix}>{suffix}</span> : null}
        {adornment ? <span className={styles.adornment}>{adornment}</span> : null}
      </div>
      {description ? <Field.Description className={styles.help}>{description}</Field.Description> : null}
      {error ? (
        <Field.Error match className={styles.error}>
          <CircleAlert aria-hidden="true" />
          {error}
        </Field.Error>
      ) : null}
    </Field.Root>
  );
}
