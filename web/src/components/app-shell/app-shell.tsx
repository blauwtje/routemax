import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Switch } from '@/components/switch/switch';
import { toast } from '@/components/toast/toast';
import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
import { useRouterSwitch } from '@/hooks/use-router-switch';
import { SECTIONS, type Section } from '@/hooks/use-section';
import styles from './app-shell.module.css';

const SECTION_LABELS: Record<Section, string> = {
  overview: 'Overview',
  activity: 'Activity',
  routing: 'Routing',
  settings: 'Settings',
};

type Mark = { left: number; width: number; animate: boolean };

/** True for a plain primary click; modified clicks keep the browser's open-in-tab behavior. */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** The router switch at the navbar's right end: mint when on, grey and "Off" when off. */
function RouterToggle() {
  const { state, setEnabled } = useRouterSwitch();
  const error = state.kind === 'ready' ? state.error : null;

  useEffect(() => {
    if (error !== null) toast.failed('Router switch not saved', error);
  }, [error]);

  if (state.kind === 'ready') {
    return (
      <Switch
        className={styles.router}
        label="Router"
        stateText={{ on: 'On', off: 'Off' }}
        checked={state.enabled}
        busy={state.saving}
        onCheckedChange={(next) => void setEnabled(next)}
      />
    );
  }
  const loading = state.kind === 'loading';
  return (
    <Switch
      className={styles.router}
      label="Router"
      stateText={{ on: '…', off: '…' }}
      checked={false}
      busy={loading}
      disabled
      aria-label={loading ? 'Router, loading' : `Router unavailable: ${state.message}`}
      onCheckedChange={() => undefined}
    />
  );
}

type AppShellProps = {
  section: Section;
  onNavigate: (next: Section) => void;
  children: ReactNode;
};

export function AppShell({ section, onNavigate, children }: AppShellProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const firstSection = useRef(true);
  const [mark, setMark] = useState<Mark | null>(null);

  // The pill follows the active link; the first placement is instant, later ones slide.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[aria-current="page"]');
      if (active === null) return;
      // Rects against the list share one origin with the pill, whatever the offsetParent is.
      const activeRect = active.getBoundingClientRect();
      const left = activeRect.left - list.getBoundingClientRect().left;
      const width = activeRect.width;
      setMark((previous) => {
        if (previous?.left === left && previous.width === width) return previous;
        return { left, width, animate: previous !== null };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    void document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [section]);

  // A new page: title, top of page, and focus on the content so assistive tech announces the change.
  useEffect(() => {
    document.title = `${SECTION_LABELS[section]} · routemax`;
    if (firstSection.current) {
      firstSection.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [section]);

  function follow(event: MouseEvent<HTMLAnchorElement>, next: Section) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onNavigate(next);
  }

  const markStyle = mark === null ? undefined : ({ '--mark-left': `${mark.left}px`, '--mark-width': `${mark.width}px` } as CSSProperties);

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.bar}>
          <a className={styles.brand} href="/overview" onClick={(event) => follow(event, 'overview')}>
            <span className={styles.tile} aria-hidden="true">
              r
            </span>
            <span className={styles.wordmark}>routemax</span>
          </a>
          <nav className={styles.nav} aria-label="Sections">
            <div className={styles.list} ref={listRef}>
              <span className={styles.pill} aria-hidden="true" data-ready={mark !== null || undefined} data-animate={mark?.animate || undefined} style={markStyle} />
              {SECTIONS.map((name) => (
                <a
                  key={name}
                  className={styles.link}
                  href={`/${name}`}
                  aria-current={name === section ? 'page' : undefined}
                  onClick={(event) => follow(event, name)}
                >
                  {SECTION_LABELS[name]}
                </a>
              ))}
            </div>
          </nav>
          <div className={styles.actions}>
            <RouterToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className={styles.main} ref={mainRef} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
