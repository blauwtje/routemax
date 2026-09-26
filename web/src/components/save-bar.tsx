import { CheckIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SaveState } from '@/hooks/use-config-form';

interface SaveBarProps {
  saveState: SaveState;
  dirty: boolean;
  previousExists: boolean;
  warnings?: string[];
  onSave: () => void;
  onRestore: () => void;
  onReload: () => void;
}

function SaveStatus({ saveState, onReload }: { saveState: SaveState; onReload: () => void }) {
  switch (saveState.kind) {
    case 'idle':
      return null;
    case 'saving':
      return <p className="save-bar-status text-sm text-muted-foreground">Saving…</p>;
    case 'saved':
      return (
        <p className="save-bar-status flex items-start gap-2 text-sm">
          <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>Saved. {saveState.chezmoiMessage}</span>
        </p>
      );
    case 'stale':
      return (
        <Alert variant="destructive">
          <AlertTitle>The config changed since this page loaded it</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col items-start gap-2">
              <p>Nothing was saved. Reload to see the current version; the edits on this page are then lost.</p>
              <Button type="button" variant="outline" size="sm" onClick={onReload}>
                Reload
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    case 'invalid':
      return (
        <Alert variant="destructive">
          <AlertTitle>Not saved: fix these fields first</AlertTitle>
          <AlertDescription>
            <ul className="save-bar-issues list-disc pl-4">
              {saveState.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      );
    case 'failed':
      return (
        <Alert variant="destructive">
          <AlertDescription>{saveState.message}</AlertDescription>
        </Alert>
      );
  }
}

function SaveBarBody({ saveState, dirty, previousExists, warnings, onSave, onRestore, onReload }: SaveBarProps & { warnings: string[] }) {
  const busy = saveState.kind === 'saving';
  return (
    <>
      {warnings.length > 0 && (
        <Alert className="save-bar-warnings">
          <AlertTitle>Check before saving</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <div aria-live="polite" className="save-bar-live contents">
        <SaveStatus saveState={saveState} onReload={onReload} />
      </div>
      <div className="save-bar-actions flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onSave} disabled={!dirty || busy}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onRestore} disabled={!previousExists || busy}>
          Restore previous version
        </Button>
        {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
      </div>
    </>
  );
}

// The bar docks fixed to the viewport (full-bleed) so it never scrolls with the page. Since this
// primitive cannot edit the page files to add bottom padding for the reserved space, an invisible
// twin renders in normal flow with identical padding/gap classes: its box height always matches the
// real bar's height (same content, same warnings/state), so page content is never covered.
export function SaveBar(props: SaveBarProps) {
  const { dirty, warnings = [] } = props;
  const bodyClass = 'flex flex-col gap-2 rounded-t-lg border border-border bg-surface-1 px-4 py-3 shadow-panel backdrop-blur-md';
  return (
    <>
      <div aria-hidden="true" className={cn('save-bar-spacer invisible', bodyClass)}>
        <SaveBarBody {...props} warnings={warnings} />
      </div>
      <div
        data-dirty={dirty}
        className={cn(
          'save-bar fixed inset-x-0 bottom-0 z-40 mx-auto max-w-fit opacity-100 translate-y-0 motion-safe:transition-[opacity,transform] motion-safe:duration-(--dur-panel) motion-safe:ease-[var(--ease-spring)] motion-safe:starting:opacity-0 motion-safe:starting:translate-y-4',
          bodyClass,
        )}
      >
        <SaveBarBody {...props} warnings={warnings} />
      </div>
    </>
  );
}
