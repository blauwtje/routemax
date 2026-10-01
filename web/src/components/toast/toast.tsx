import { Toast as BaseToast } from '@base-ui/react/toast';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusDot, type Tone } from '../badge/badge';
import styles from './toast.module.css';

export const toastManager = BaseToast.createToastManager();

const TONES: Record<string, Tone> = { saved: 'ok', failed: 'danger', stale: 'warn' };

type ActionOptions = { label: string; onClick: () => void };

/** Callable from anywhere, including the autosave queue. Saved waits long enough to reach Undo; failed and stale stay until dismissed. */
export const toast = {
  saved: (description?: string, undo?: () => void) =>
    toastManager.add({ type: 'saved', title: 'Saved', description, timeout: undo ? 10000 : 4000, actionProps: undo ? { children: 'Undo', onClick: undo } : undefined }),
  failed: (title: string, description?: string, retry?: ActionOptions) =>
    toastManager.add({ type: 'failed', title, description, timeout: 0, priority: 'high', actionProps: retry ? { children: retry.label, onClick: retry.onClick } : undefined }),
  stale: (reload: () => void) =>
    toastManager.add({ type: 'stale', title: 'Config changed elsewhere', description: 'Nothing was saved. Reload to see the latest.', timeout: 0, priority: 'high', actionProps: { children: 'Reload', onClick: reload } }),
};

function ToastList() {
  const { toasts } = BaseToast.useToastManager();
  return toasts.map((item) => (
    <BaseToast.Root key={item.id} toast={item} className={styles.root} data-type={item.type}>
      <StatusDot tone={TONES[item.type ?? ''] ?? 'neutral'} />
      <BaseToast.Content className={styles.content}>
        <BaseToast.Title className={styles.title} />
        <BaseToast.Description className={styles.description} />
      </BaseToast.Content>
      {item.actionProps ? <BaseToast.Action className={styles.action} /> : null}
      <BaseToast.Close className={styles.close} aria-label="Dismiss">
        <X aria-hidden="true" />
      </BaseToast.Close>
    </BaseToast.Root>
  ));
}

/** Mount once at the root: stack of at most three, bottom end, one region for the product. */
export function ToastHost({ children }: { children?: ReactNode }) {
  return (
    <BaseToast.Provider toastManager={toastManager} limit={3}>
      {children}
      <BaseToast.Portal>
        <BaseToast.Viewport className={styles.viewport}>
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}
