import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentProps, ReactNode } from 'react';
import styles from './button.module.css';

type ButtonProps = Omit<ComponentProps<typeof BaseButton>, 'className'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  /** Leading icon, or the only content of an icon-only button (then set aria-label). */
  icon?: ReactNode;
  iconOnly?: boolean;
  /** Holds the label, shows a spinner and blocks activation. */
  loading?: boolean;
  className?: string;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  loading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <BaseButton
      {...rest}
      focusableWhenDisabled
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      data-icon-only={iconOnly || undefined}
      data-loading={loading || undefined}
      className={[styles.root, className].filter(Boolean).join(' ')}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      {iconOnly ? null : <span className={styles.label}>{children}</span>}
    </BaseButton>
  );
}
