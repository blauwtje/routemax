import { useCallback, useEffect, useState } from 'react';

export const SECTIONS = ['overview', 'history', 'routing', 'providers', 'settings'] as const;
export type Section = (typeof SECTIONS)[number];

function sectionFromPath(pathname: string): Section {
  const name = pathname.replace(/^\/+|\/+$/g, '');
  return SECTIONS.find((section) => section === name) ?? 'overview';
}

export function useSection(): [Section, (next: Section) => void] {
  const [section, setSection] = useState<Section>(() => sectionFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setSection(sectionFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: Section) => {
    window.history.pushState(null, '', `/${next}`);
    setSection(next);
  }, []);

  return [section, navigate];
}
