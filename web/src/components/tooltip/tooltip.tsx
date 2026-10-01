import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';
import styles from './tooltip.module.css';

/** Mount once near the root so neighbouring tooltips share the open delay. */
export const TooltipProvider = BaseTooltip.Provider;

type TooltipProps = {
  /** One sentence; nothing essential lives only here. */
  content: ReactNode;
  /** The single element that triggers it. */
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8} className={styles.positioner}>
          <BaseTooltip.Popup className={styles.popup}>{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
