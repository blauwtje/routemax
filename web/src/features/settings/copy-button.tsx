import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Copies `value` to the clipboard and swaps the icon to a check mark to confirm. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (value === '') return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('text-muted-foreground hover:text-foreground', className)}
      aria-label={copied ? `${label} copied to clipboard` : `Copy ${label}`}
      disabled={value === ''}
      onClick={() => void handleCopy()}
    >
      {copied ? (
        <CheckIcon
          aria-hidden="true"
          className="text-status-positive motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-150"
        />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
    </Button>
  );
}
