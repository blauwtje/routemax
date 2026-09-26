import { cn } from '@/lib/utils';

/**
 * A loading placeholder row: a shimmer sweep across a surface-2 tile, static under
 * prefers-reduced-motion (global reduced-motion rule collapses the animation duration).
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'relative overflow-hidden rounded-md bg-surface-2',
        'before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,var(--foreground)_10%,transparent),transparent)]',
        'motion-safe:before:animate-[shimmer_1.4s_ease-in-out_infinite]',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
