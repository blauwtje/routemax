import type { ComponentType } from 'react';
import { AppShell } from '@/components/app-shell';
import { HistoryPage } from '@/features/history/history-page';
import { OverviewPage } from '@/features/overview/overview-page';
import { ProvidersPage } from '@/features/providers/providers-page';
import { RoutingPage } from '@/features/routing/routing-page';
import { SettingsPage } from '@/features/settings/settings-page';
import { type Section, useSection } from '@/hooks/use-section';

const SECTION_PAGES: Partial<Record<Section, ComponentType>> = {
  overview: OverviewPage,
  history: HistoryPage,
  routing: RoutingPage,
  providers: ProvidersPage,
  settings: SettingsPage,
};

export function App() {
  const [section, navigate] = useSection();
  const Page = SECTION_PAGES[section];
  return (
    <AppShell section={section} onNavigate={navigate}>
      {Page === undefined ? <p className="text-muted-foreground">This section is not built yet.</p> : <Page />}
    </AppShell>
  );
}
