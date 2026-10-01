import { Monitor, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/button/button';
import { Menu } from '@/components/menu/menu';
import { THEMES, type Theme, useTheme } from '@/hooks/use-theme';
import styles from './theme-toggle.module.css';

const THEME_COPY: Record<Theme, { label: string; icon: ReactNode }> = {
  system: { label: 'System', icon: <Monitor aria-hidden="true" /> },
  dark: { label: 'Dark', icon: <Moon aria-hidden="true" /> },
  light: { label: 'Light', icon: <Sun aria-hidden="true" /> },
};

function isTheme(value: string): value is Theme {
  return THEMES.some((theme) => theme === value);
}

/** One icon button that opens a System / Dark / Light radio menu; the icon shows the current choice. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const current = THEME_COPY[theme];

  return (
    <Menu
      trigger={
        <Button variant="ghost" iconOnly className={styles.trigger} icon={current.icon} aria-label={`Theme: ${current.label}`} />
      }
      choice={{
        label: 'Theme',
        value: theme,
        options: THEMES.map((value) => ({ value, label: THEME_COPY[value].label, icon: THEME_COPY[value].icon })),
        onValueChange: (value) => {
          if (isTheme(value)) setTheme(value);
        },
      }}
    />
  );
}
