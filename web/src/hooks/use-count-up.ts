import { useEffect, useRef, useState } from 'react';

const EASE_OUT_EXPO = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Counts a number up from 0 to `value` over `durationMs` using rAF and an ease-out-expo curve.
 * Under prefers-reduced-motion the final value renders immediately, with no intermediate frames
 * (motion reference: Reduced motion, the state change still happens, just not the travel).
 */
export function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0));
  const frame = useRef<number>(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      setDisplay(from + (value - from) * EASE_OUT_EXPO(t));
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    }
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, durationMs]);

  return display;
}
