import { Menu as BaseMenu } from '@base-ui/react/menu';
import { Check } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import styles from './menu.module.css';

export type MenuAction = { id: string; label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean };
export type MenuChoice = { label: string; value: string; options: { value: string; label: string; icon?: ReactNode }[]; onValueChange: (value: string) => void };

type MenuProps = {
  /** The single element that opens the menu; keep an aria-label on icon buttons. */
  trigger: ReactElement;
  choice?: MenuChoice;
  actions?: MenuAction[];
  align?: 'start' | 'center' | 'end';
};

export function Menu({ trigger, choice, actions = [], align = 'end' }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner className={styles.positioner} align={align} sideOffset={6}>
          <BaseMenu.Popup className={styles.popup}>
            {choice ? (
              <BaseMenu.Group>
                <BaseMenu.GroupLabel className={styles.groupLabel}>{choice.label}</BaseMenu.GroupLabel>
                <BaseMenu.RadioGroup value={choice.value} onValueChange={(next) => choice.onValueChange(String(next))}>
                  {choice.options.map((option) => (
                    <BaseMenu.RadioItem key={option.value} value={option.value} className={styles.item}>
                      {option.icon}
                      <span className={styles.text}>{option.label}</span>
                      <BaseMenu.RadioItemIndicator className={styles.check}>
                        <Check aria-hidden="true" />
                      </BaseMenu.RadioItemIndicator>
                    </BaseMenu.RadioItem>
                  ))}
                </BaseMenu.RadioGroup>
              </BaseMenu.Group>
            ) : null}
            {choice && actions.length > 0 ? <BaseMenu.Separator className={styles.separator} /> : null}
            {actions.map((action) => (
              <BaseMenu.Item key={action.id} className={styles.item} data-danger={action.danger || undefined} disabled={action.disabled} onClick={action.onSelect}>
                {action.icon}
                <span className={styles.text}>{action.label}</span>
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
