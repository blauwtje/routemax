import { CheckIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
            Nothing was saved. Reload to see the current version; the edits on this page are then lost.
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onReload}>
              Reload
            </Button>
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

export function SaveBar({ saveState, dirty, previousExists, warnings = [], onSave, onRestore, onReload }: SaveBarProps) {
  const busy = saveState.kind === 'saving';
  return (
    <div className="save-bar sticky bottom-3 flex flex-col gap-2 rounded-xl border bg-card/95 px-4 py-3 shadow-(--shadow-card) backdrop-blur-sm">
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
    </div>
  );
}
