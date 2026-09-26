import { useId } from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
  values: number[];
  color: string;
  className?: string;
}

const WIDTH = 100;
const HEIGHT = 28;

/** Builds an SVG line + area path for `values`, scaled into a WIDTH x HEIGHT viewBox. */
function buildPath(values: number[]): { line: string; area: string } {
  if (values.length === 0) return { line: '', area: '' };
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = step * i;
    const y = HEIGHT - ((v - min) / range) * HEIGHT;
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;
  return { line, area };
}

/**
 * A 7-day trend line: an SVG path that draws in with stroke-dashoffset, over an area gradient
 * fill of `color` fading to transparent (contract: kinetic-figures / count-up-figures-with-sparklines).
 */
export function Sparkline({ values, color, className }: SparklineProps) {
  const gradientId = useId();
  const { line, area } = buildPath(values);
  if (!line) return null;
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn('sparkline h-7 w-full overflow-visible', className)}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        className="sparkline-line motion-safe:[stroke-dasharray:100] motion-safe:[stroke-dashoffset:100] motion-safe:animate-[sparkline-draw_var(--dur-sparkline)_var(--ease-out-expo)_forwards]"
      />
    </svg>
  );
}
