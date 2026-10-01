import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { Select } from '@/components/select/select';
import { TextField } from '@/components/text-field/text-field';
import { EFFORT_ORDER, type Effort } from '../../../../src/config/config-schema';
import styles from './agent-dialog.module.css';

export type ClaudeAgent = { model: string; effort: Effort };

export const EFFORT_OPTIONS = EFFORT_ORDER.map((effort) => ({ value: effort, label: effort }));

type AgentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing agent name, or null to add a new agent. */
  name: string | null;
  agents: Record<string, ClaudeAgent>;
  /** Why the agent cannot be removed, when something still points at it. */
  lockedReason?: string;
  onChange: (name: string, agent: ClaudeAgent) => void;
  onRemove: (name: string) => void;
};

// Existing agents edit live; a new agent is committed once with "Add agent".
export function AgentDialog({ open, onOpenChange, name, agents, lockedReason, onChange, onRemove }: AgentDialogProps) {
  const adding = name === null;
  const [draftName, setDraftName] = useState('');
  const [draft, setDraft] = useState<ClaudeAgent>({ model: '', effort: 'medium' });
  const agent = adding ? draft : (agents[name] ?? draft);
  const trimmed = draftName.trim();
  const duplicate = adding && Object.hasOwn(agents, trimmed);
  const nameError = duplicate ? 'An agent with this name exists.' : undefined;
  const modelId = 'agent-model';
  const effortId = 'agent-effort';

  function update(next: ClaudeAgent) {
    if (adding) setDraft(next);
    else onChange(name, next);
  }

  function commit() {
    onChange(trimmed, draft);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={adding ? 'Add agent' : 'Edit agent'}
      description="Tasks on the claude tier run on the agent named for their task type, or on the default agent."
      meta={adding ? undefined : name}
      footerStart={
        adding ? null : (
          <Button variant="danger" icon={<Trash2 aria-hidden="true" />} disabled={Boolean(lockedReason)} onClick={() => onRemove(name)}>
            Remove agent
          </Button>
        )
      }
      footerEnd={
        adding ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={trimmed === '' || duplicate} onClick={commit}>
              Add agent
            </Button>
          </>
        ) : (
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        )
      }
    >
      <div className={styles.stack}>
        {adding ? (
          <TextField mono label="Agent name" autoComplete="off" spellCheck={false} value={draftName} error={nameError} onChange={(event) => setDraftName(event.target.value)} />
        ) : null}
        <TextField mono label="Model" autoComplete="off" spellCheck={false} id={modelId} value={agent.model} onChange={(event) => update({ ...agent, model: event.target.value })} />
        <div className={styles.selectField}>
          <label className={styles.label} htmlFor={effortId}>
            Effort
          </label>
          <Select mono id={effortId} options={EFFORT_OPTIONS} value={agent.effort} onValueChange={(effort) => update({ ...agent, effort: effort as Effort })} />
        </div>
        {lockedReason ? <p className={styles.note}>{lockedReason}</p> : null}
      </div>
    </Dialog>
  );
}
