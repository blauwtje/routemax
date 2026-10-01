import { useCallback, useLayoutEffect, useState } from 'react';

export type Theme = 'system' | 'dark' | 'light';

export const THEMES: readonly Theme[] = ['system', 'dark', 'light'];

const STORAGE_KEY = 'routemax-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'system';
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this visit only.
    return 'system';
  }
}

/**
 * The chosen theme, remembered in localStorage and resolved onto
 * document.documentElement.dataset.theme. 'system' follows prefers-color-scheme live.
 */
export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const query = window.matchMedia(DARK_QUERY);
    const apply = () => {
      root.dataset.theme = theme === 'system' ? (query.matches ? 'dark' : 'light') : theme;
    };
    apply();
    if (theme !== 'system') return;
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);

  const choose = useCallback((next: Theme) => {
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // See readStoredTheme: an unsaved choice still applies now.
    }
  }, []);

  return [theme, choose];
}
