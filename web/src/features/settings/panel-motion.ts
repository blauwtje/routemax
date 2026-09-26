/**
 * Settings groups render as machined panels (surface-1 + shadow-panel, which already carries the
 * inner top highlight) instead of flat top-rule sections, with a staggered fade+rise entrance
 * (recorded motion decision: --dur-page, 40ms stagger, max 6, motion-safe only). SettingsGroup takes
 * no style prop, so the per-panel delay is baked into literal Tailwind arbitrary classes (Tailwind's
 * scanner needs the full class string in source) rather than passed as inline style.
 */
const BASE =
  'rounded-lg border-t-0 bg-surface-1 p-5 pt-5 shadow-panel motion-safe:animate-[page-enter_var(--dur-page)_var(--ease-out-expo)_both]';

export const PANEL_CLASS = [
  `${BASE} motion-safe:[animation-delay:0ms]`,
  `${BASE} motion-safe:[animation-delay:40ms]`,
  `${BASE} motion-safe:[animation-delay:80ms]`,
  `${BASE} motion-safe:[animation-delay:120ms]`,
  `${BASE} motion-safe:[animation-delay:160ms]`,
  `${BASE} motion-safe:[animation-delay:200ms]`,
] as const;
