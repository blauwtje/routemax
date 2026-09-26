import type { ComponentType } from 'react';
import { AppShell } from '@/components/app-shell';
import { type Section, useSection } from '@/hooks/use-section';

const SECTION_PAGES: Partial<Record<Section, ComponentType>> = {};

export function App() {
  const [section, navigate] = useSection();
  const Page = SECTION_PAGES[section];
  return (
    <AppShell section={section} onNavigate={navigate}>
      {Page === undefined ? <p className="text-muted-foreground">This section is not built yet.</p> : <Page />}
    </AppShell>
  );
}
