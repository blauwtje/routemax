import type { HTMLAttributes, ReactNode } from 'react';
import styles from './badge.module.css';

export type TierId = 'flash-low' | 'flash-high' | 'pro-high' | 'claude';
export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'busy';

const TIER_NAMES: Record<TierId, string> = {
  'flash-low': 'Flash low',
  'flash-high': 'Flash high',
  'pro-high': 'Pro high',
  claude: 'Claude',
};

/** The 8px square that is the only place a tier hue appears beside its name. */
export function TierDot({ tier }: { tier: TierId }) {
  return <span className={styles.tierDot} data-tier={tier} aria-hidden="true" />;
}

/** The round dot of a status; the word beside it carries the meaning. */
export function StatusDot({ tone }: { tone: Tone }) {
  return <span className={styles.statusDot} data-tone={tone} aria-hidden="true" />;
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tier?: TierId;
  tone?: Tone;
  children?: ReactNode;
};

/** Dot plus word. Pass `tier` for a tier, or `tone` with the status word as children. */
export function Badge({ tier, tone = 'neutral', children, className, ...rest }: BadgeProps) {
  const label = children ?? (tier ? TIER_NAMES[tier] : null);
  return (
    <span {...rest} className={[styles.root, className].filter(Boolean).join(' ')}>
      {tier ? <TierDot tier={tier} /> : <StatusDot tone={tone} />}
      <span className={styles.label}>{label}</span>
    </span>
  );
}
