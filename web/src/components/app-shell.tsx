import type { MouseEvent, ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { SECTIONS, type Section } from '@/hooks/use-section';
import { useRouterSwitch } from '@/hooks/use-router-switch';
import { cn } from '@/lib/utils';

const SECTION_COPY: Record<Section, { label: string; description: string }> = {
  overview: { label: 'Overview', description: 'Spend, tiers and health at a glance.' },
  activity: { label: 'Activity', description: 'Every call the router made, audited.' },
  routing: { label: 'Routing', description: 'Tiers, efforts, agents and rules.' },
  settings: { label: 'Settings', description: 'Budget, timeouts and project commands.' },
};

/* the wordmark's tier mark: four bars in ordinal tier hue, tallest last (contract: tier-regions) */
function TierMark() {
  return (
    <span aria-hidden="true" className="inline-flex h-4 items-end gap-[2px]">
      <span className="w-[3px] rounded-full bg-tier-flash-low" style={{ height: '40%' }} />
      <span className="w-[3px] rounded-full bg-tier-flash-high" style={{ height: '60%' }} />
      <span className="w-[3px] rounded-full bg-tier-pro-high" style={{ height: '80%' }} />
      <span className="w-[3px] rounded-full bg-tier-claude" style={{ height: '100%' }} />
    </span>
  );
}

function SignalLamp() {
  const { state } = useRouterSwitch();
  const routerOn = state.kind === 'ready' && state.enabled;
  const loading = state.kind === 'loading';
  return (
    <span className="app-shell-signal inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <span className="relative inline-flex size-2.5 shrink-0">
        {!loading && routerOn ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full motion-safe:animate-[router-pulse-ring_2s_ease-out_infinite]"
            style={{ backgroundColor: 'var(--router-glow)' }}
          />
        ) : null}
        <span
          aria-hidden="true"
          className={cn(
            'relative size-2.5 rounded-full motion-safe:transition-[background-color,box-shadow] motion-safe:duration-(--dur-router-glow) motion-safe:ease-(--ease-out-expo)',
            loading && 'bg-muted-foreground/40',
          )}
          style={
            loading
              ? undefined
              : { backgroundColor: 'var(--router-glow)', boxShadow: '0 0 8px var(--router-glow)' }
          }
        />
      </span>
      {loading ? 'Loading…' : routerOn ? 'Routing to workers' : 'Everything on Claude'}
    </span>
  );
}

interface AppShellProps {
  section: Section;
  onNavigate: (next: Section) => void;
  children: ReactNode;
}

export function AppShell({ section, onNavigate, children }: AppShellProps) {
  const index = SECTIONS.indexOf(section);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [pill, setPill] = useState({ left: 0, width: 0 });
  const { state } = useRouterSwitch();
  const routerOn = state.kind === 'ready' && state.enabled;

  useLayoutEffect(() => {
    document.documentElement.dataset.router = state.kind === 'loading' ? 'off' : routerOn ? 'on' : 'off';
  }, [state.kind, routerOn]);

  useLayoutEffect(() => {
    function measure() {
      const link = linkRefs.current[index];
      if (!link) return;
      setPill({ left: link.offsetLeft, width: link.offsetWidth });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [index]);

  function follow(event: MouseEvent<HTMLAnchorElement>, next: Section) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(next);
  }

  const copy = SECTION_COPY[section];

  return (
    <div className="app-shell min-h-svh text-foreground">
      <header className="app-shell-masthead sticky top-0 z-40 border-b border-border backdrop-blur-md backdrop-saturate-[1.4] [background-color:color-mix(in_oklch,var(--ground)_70%,transparent)]">
        <div className="mx-auto flex min-w-0 max-w-[1200px] flex-col gap-2 px-4 py-3 sm:px-8 lg:h-14 lg:flex-row lg:items-center lg:gap-6 lg:py-0">
          <div className="flex items-center justify-between gap-4 lg:contents">
            <span className="app-shell-name inline-flex items-center gap-2 text-[16px] font-semibold">
              routemax
              <TierMark />
            </span>
            <span className="lg:hidden">
              <SignalLamp />
            </span>
          </div>
          <nav
            aria-label="Sections"
            className="app-shell-nav relative flex min-w-0 flex-1 flex-nowrap gap-0.5 overflow-x-auto pe-4 sm:gap-4 sm:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent_100%)] lg:overflow-x-visible lg:pe-0 lg:[mask-image:none]"
          >
            <span
              aria-hidden="true"
              className="app-shell-indicator pointer-events-none absolute inset-y-1 left-0 rounded-md border border-border-strong bg-surface-2 motion-safe:transition-[transform,width] motion-safe:duration-(--dur-nav) motion-safe:ease-(--ease-out-expo)"
              style={{ transform: `translateX(${pill.left}px)`, width: `${pill.width}px` }}
            />
            {SECTIONS.map((name, i) => (
              <a
                key={name}
                ref={(el) => {
                  linkRefs.current[i] = el;
                }}
                href={`/${name}`}
                aria-current={name === section ? 'page' : undefined}
                onClick={(event) => follow(event, name)}
                className={cn(
                  'app-shell-link relative flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-[13px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-3 sm:text-[14px]',
                  name === section && 'text-foreground',
                )}
              >
                {SECTION_COPY[name].label}
              </a>
            ))}
          </nav>
          <span className="hidden lg:block">
            <SignalLamp />
          </span>
        </div>
      </header>
      {section === 'overview' ? null : (
        <div className="app-shell-page-header mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-6 sm:px-8">
          <h1 className="text-[32px] leading-none sm:text-[40px]">{copy.label}</h1>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
      )}
      <main key={section} className="app-shell-main mx-auto w-full max-w-[1200px] px-4 pb-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
