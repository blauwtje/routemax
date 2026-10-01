import { useCallback, useEffect, useState } from 'react';

export const SECTIONS = ['overview', 'activity', 'routing', 'settings'] as const;
export type Section = (typeof SECTIONS)[number];

export const LEGACY_PATHS: Record<string, Section> = { history: 'activity', providers: 'routing' };

function sectionFromPath(pathname: string): Section {
  const name = pathname.replace(/^\/+|\/+$/g, '');
  return SECTIONS.find((section) => section === name) ?? LEGACY_PATHS[name] ?? 'overview';
}

/** Reads the section from the address bar and rewrites an old path to its new one without a history entry. */
export function readSection(): Section {
  const section = sectionFromPath(window.location.pathname);
  const name = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (name in LEGACY_PATHS) window.history.replaceState(null, '', `/${section}`);
  return section;
}

export function useSection(): [Section, (next: Section) => void] {
  const [section, setSection] = useState<Section>(readSection);

  useEffect(() => {
    const onPopState = () => setSection(readSection());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: Section) => {
    window.history.pushState(null, '', `/${next}`);
    setSection(next);
  }, []);

  return [section, navigate];
}
