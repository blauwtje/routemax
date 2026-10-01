import { Switch as BaseSwitch } from '@base-ui/react/switch';
import type { ReactNode } from 'react';
import styles from './switch.module.css';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label; omit and pass aria-label for a bare switch. */
  label?: ReactNode;
  /** Words shown beside the label, for example { on: 'On', off: 'Off' }. */
  stateText?: { on: string; off: string };
  size?: 'sm' | 'lg';
  disabled?: boolean;
  /** A save is in flight: announced as busy and not operable. */
  busy?: boolean;
  'aria-label'?: string;
  className?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  label,
  stateText,
  size = 'sm',
  disabled,
  busy = false,
  className,
  'aria-label': ariaLabel,
}: SwitchProps) {
  return (
    <label className={[styles.wrap, className].filter(Boolean).join(' ')} data-size={size} data-disabled={disabled || undefined}>
      <BaseSwitch.Root
        className={styles.root}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        aria-label={ariaLabel}
        data-busy={busy || undefined}
        data-size={size}
      >
        <BaseSwitch.Thumb className={styles.thumb} />
      </BaseSwitch.Root>
      {label ? <span className={styles.label}>{label}</span> : null}
      {stateText ? <span className={styles.state}>{checked ? stateText.on : stateText.off}</span> : null}
    </label>
  );
}
