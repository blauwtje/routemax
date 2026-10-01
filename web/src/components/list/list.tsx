import type { ReactNode } from 'react';
import styles from './list.module.css';

export function List({ children, 'aria-label': ariaLabel }: { children: ReactNode; 'aria-label'?: string }) {
  return (
    <ul className={styles.list} aria-label={ariaLabel}>
      {children}
    </ul>
  );
}

type ListRowProps = {
  /** Mono column on the left: index, time. */
  lead?: ReactNode;
  title: ReactNode;
  /** Mono secondary line, for example "id · 4 models". */
  subtitle?: ReactNode;
  /** Status beside the title, usually a Badge. */
  status?: ReactNode;
  /** Controls beside the row (switch, move buttons). Never nested in the open button. */
  trailing?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
  selected?: boolean;
  invalid?: boolean;
  disabled?: boolean;
};

export function ListRow({ lead, title, subtitle, status, trailing, onOpen, openLabel, selected, invalid, disabled }: ListRowProps) {
  const content = (
    <>
      {lead ? <span className={styles.lead}>{lead}</span> : null}
      <span className={styles.main}>
        <span className={styles.title}>{title}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
      {status ? <span className={styles.status}>{status}</span> : null}
    </>
  );
  return (
    <li className={styles.row} data-selected={selected || undefined} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      {onOpen ? (
        <button type="button" className={styles.open} onClick={onOpen} aria-label={openLabel} disabled={disabled} aria-current={selected || undefined}>
          {content}
        </button>
      ) : (
        <div className={styles.open}>{content}</div>
      )}
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </li>
  );
}

export function ListEmpty({ children }: { children: ReactNode }) {
  return <li className={styles.empty}>{children}</li>;
}

/** Reserves the geometry of `rows` rows while data loads; carries no text. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className={styles.list} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className={styles.row}>
          <div className={styles.open}>
            <span className={styles.bar} />
          </div>
        </li>
      ))}
    </ul>
  );
}
