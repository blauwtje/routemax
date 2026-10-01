import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './dialog.module.css';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Mono readout beside the title, for example "Rule 03". */
  meta?: ReactNode;
  size?: 'narrow' | 'wide';
  /** Destructive action, left of the footer. */
  footerStart?: ReactNode;
  /** Primary action, right of the footer. */
  footerEnd?: ReactNode;
  children: ReactNode;
};

/** Always centered, never a side sheet. Focus returns to the opener on close. */
export function Dialog({ open, onOpenChange, title, description, meta, size = 'narrow', footerStart, footerEnd, children }: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={styles.backdrop} />
        <BaseDialog.Viewport className={styles.viewport}>
          <BaseDialog.Popup className={styles.popup} data-size={size}>
            <header className={styles.header}>
              <div className={styles.heading}>
                <BaseDialog.Title className={styles.title}>{title}</BaseDialog.Title>
                {description ? <BaseDialog.Description className={styles.description}>{description}</BaseDialog.Description> : null}
              </div>
              {meta ? <span className={styles.meta}>{meta}</span> : null}
              <BaseDialog.Close className={styles.close} aria-label="Close">
                <X aria-hidden="true" />
              </BaseDialog.Close>
            </header>
            <div className={styles.body}>{children}</div>
            {footerStart || footerEnd ? (
              <footer className={styles.footer}>
                <div className={styles.footerStart}>{footerStart}</div>
                <div className={styles.footerEnd}>{footerEnd}</div>
              </footer>
            ) : null}
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
