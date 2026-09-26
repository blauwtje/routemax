import type { MouseEvent, ReactNode } from 'react';
import { SECTIONS, type Section } from '@/hooks/use-section';
import { cn } from '@/lib/utils';

const SECTION_LABELS: Record<Section, string> = {
  overview: 'Overview',
  history: 'History',
  routing: 'Routing',
  providers: 'Providers',
  settings: 'Settings',
};

interface AppShellProps {
  section: Section;
  onNavigate: (next: Section) => void;
  children: ReactNode;
}

export function AppShell({ section, onNavigate, children }: AppShellProps) {
  function follow(event: MouseEvent<HTMLAnchorElement>, next: Section) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(next);
  }

  return (
    <div className="app-shell min-h-svh bg-background text-foreground">
      <header className="app-shell-header border-b">
        <div className="app-shell-bar mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="app-shell-name flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/20" />
            routemax
          </span>
          <nav aria-label="Sections" className="app-shell-nav flex flex-wrap gap-1">
            {SECTIONS.map((name) => (
              <a
                key={name}
                href={`/${name}`}
                aria-current={name === section ? 'page' : undefined}
                onClick={(event) => follow(event, name)}
                className={cn(
                  'app-shell-link inline-flex min-h-9 items-center rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors motion-safe:duration-[var(--dur-feedback)] motion-safe:ease-[var(--ease-out)]',
                  name === section && 'bg-card text-foreground shadow-[inset_0_-2px_0_var(--primary)]',
                )}
              >
                {SECTION_LABELS[name]}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="app-shell-main mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
