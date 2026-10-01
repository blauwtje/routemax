import type { ComponentType } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { ToastHost } from '@/components/toast/toast';
import { ActivityPage } from '@/features/activity/activity-page';
import { OverviewPage } from '@/features/overview/overview-page';
import { RoutingPage } from '@/features/routing/routing-page';
import { SettingsPage } from '@/features/settings/settings-page';
import { type Section, useSection } from '@/hooks/use-section';
import { RouterSwitchProvider } from '@/hooks/use-router-switch';

const SECTION_PAGES: Record<Section, ComponentType> = {
  overview: OverviewPage,
  activity: ActivityPage,
  routing: RoutingPage,
  settings: SettingsPage,
};

export function App() {
  const [section, navigate] = useSection();
  const Page = SECTION_PAGES[section];
  return (
    <RouterSwitchProvider>
      <ToastHost>
        <AppShell section={section} onNavigate={navigate}>
          <Page />
        </AppShell>
      </ToastHost>
    </RouterSwitchProvider>
  );
}
