import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';
import styles from './tabs.module.css';

export type TabItem = { value: string; label: ReactNode; content: ReactNode; disabled?: boolean };

type TabsProps = {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  'aria-label'?: string;
  className?: string;
};

/** One tab stop on the active tab; arrows move and wrap; the pill slides between tabs. */
export function Tabs({ items, value, onValueChange, className, 'aria-label': ariaLabel }: TabsProps) {
  return (
    <BaseTabs.Root className={[styles.root, className].filter(Boolean).join(' ')} value={value} onValueChange={(next) => onValueChange(String(next))}>
      <BaseTabs.List className={styles.list} aria-label={ariaLabel}>
        {items.map((item) => (
          <BaseTabs.Tab key={item.value} value={item.value} disabled={item.disabled} className={styles.tab}>
            {item.label}
          </BaseTabs.Tab>
        ))}
        <BaseTabs.Indicator className={styles.indicator} />
      </BaseTabs.List>
      {items.map((item) => (
        <BaseTabs.Panel key={item.value} value={item.value} className={styles.panel}>
          {item.content}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  );
}
