import { ArrowDown, ArrowRight, ArrowUp, MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { Badge, type TierId } from '@/components/badge/badge';
import { Button } from '@/components/button/button';
import { List, ListEmpty, ListRow } from '@/components/list/list';
import { Menu } from '@/components/menu/menu';
import { Select } from '@/components/select/select';
import { TextField } from '@/components/text-field/text-field';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER, type Effort } from '../../../../src/config/config-schema';
import { AgentDialog, EFFORT_OPTIONS, type ClaudeAgent } from './agent-dialog';
import { RULE_LIST_FIELDS, RuleDialog } from './rule-dialog';
import styles from './rules-section.module.css';

type RuleValues = {
  id?: string;
  tier?: string;
  taskTypes?: string[];
  keywords?: string[];
  keywordExemptTaskTypes?: string[];
  flags?: string[];
};

const SAVE_OPTIONS = { shouldDirty: true, shouldValidate: true } as const;

function matchSummary(rule: RuleValues) {
  const clauses: string[] = [];
  for (const [name, , tag] of RULE_LIST_FIELDS) {
    const values = rule[name];
    if (values !== undefined && values.length > 0) clauses.push(`${tag} ${values.join(', ')}`);
  }
  return clauses.length === 0 ? 'Matches nothing yet' : clauses.join(' · ');
}

type BlockProps = { id: string; title: string; description: string; action?: ReactNode; children: ReactNode };

function Block({ id, title, description, action, children }: BlockProps) {
  return (
    <section className={styles.block} aria-labelledby={id}>
      <header className={styles.blockHeader}>
        <div className={styles.blockHeading}>
          <h3 id={id} className={styles.blockTitle}>
            {title}
          </h3>
          <p className={styles.blockDescription}>{description}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function RulesSection({ form }: { form: ConfigForm }) {
  return (
    <div className={styles.root}>
      <RulesBlock form={form} />
      <EffortMapBlock form={form} />
      <ClaudeBlock form={form} />
    </div>
  );
}

function RulesBlock({ form }: { form: ConfigForm }) {
  const { fields, append, move, remove } = useFieldArray({ control: form.control, name: 'rules', keyName: 'fieldKey' });
  const watchedRules = useWatch({ control: form.control, name: 'rules' });
  const ruleErrors = form.formState.errors.rules;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function editRule(index: number) {
    setEditingIndex(index);
    setDialogOpen(true);
  }

  function addRule() {
    append({ id: '', taskTypes: [], keywords: [], keywordExemptTaskTypes: [], flags: [], tier: 'flash-low' });
    editRule(fields.length);
  }

  // The removed row has no trigger to refocus and its index no longer exists: unmount at once.
  function removeRule(index: number) {
    setDialogOpen(false);
    setEditingIndex(null);
    remove(index);
  }

  return (
    <Block
      id="rules-title"
      title="Rules"
      description="A task goes to the highest tier among the rules it matches. When two rules raise it to the same tier, the upper one is named in History."
      action={
        <Button variant="secondary" icon={<Plus aria-hidden="true" />} onClick={addRule}>
          Add rule
        </Button>
      }
    >
      <List aria-label="Rules">
        {fields.length === 0 ? <ListEmpty>No rules yet. Every task starts at the tier its caller asks for.</ListEmpty> : null}
        {fields.map((field, index) => {
          const rule: RuleValues = watchedRules?.[index] ?? field;
          const name = rule.id || 'Untitled rule';
          return (
            <ListRow
              key={field.fieldKey}
              lead={String(index + 1).padStart(2, '0')}
              title={<span className={styles.mono}>{name}</span>}
              subtitle={matchSummary(rule)}
              status={
                <span className={styles.target}>
                  <ArrowRight aria-hidden="true" className={styles.arrow} />
                  <Badge tier={(rule.tier ?? 'flash-low') as TierId} />
                </span>
              }
              invalid={ruleErrors?.[index] !== undefined}
              onOpen={() => editRule(index)}
              openLabel={`Edit rule ${name}`}
              trailing={
                <Menu
                  trigger={<Button variant="ghost" size="sm" iconOnly icon={<MoreHorizontal aria-hidden="true" />} aria-label={`Actions for rule ${name}`} />}
                  actions={[
                    { id: 'up', label: 'Move up', icon: <ArrowUp aria-hidden="true" />, disabled: index === 0, onSelect: () => move(index, index - 1) },
                    { id: 'down', label: 'Move down', icon: <ArrowDown aria-hidden="true" />, disabled: index === fields.length - 1, onSelect: () => move(index, index + 1) },
                    { id: 'remove', label: 'Remove rule', icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: () => removeRule(index) },
                  ]}
                />
              }
            />
          );
        })}
      </List>
      {editingIndex !== null && editingIndex < fields.length ? (
        <RuleDialog form={form} open={dialogOpen} index={editingIndex} onOpenChange={setDialogOpen} onRemove={removeRule} />
      ) : null}
    </Block>
  );
}

function EffortMapBlock({ form }: { form: ConfigForm }) {
  const effortMap = useWatch({ control: form.control, name: 'effortMap' });
  return (
    <Block id="effort-title" title="Effort map" description="How hard a worker thinks for each effort Claude asks for.">
      <List aria-label="Effort map">
        {EFFORT_ORDER.map((claudeEffort) => (
          <ListRow
            key={claudeEffort}
            title={<span className={styles.mono}>{claudeEffort}</span>}
            trailing={
              <span className={styles.target}>
                <ArrowRight aria-hidden="true" className={styles.arrow} />
                <Select
                  mono
                  className={styles.effortSelect}
                  aria-label={`Worker effort for ${claudeEffort}`}
                  options={EFFORT_OPTIONS}
                  value={effortMap?.[claudeEffort] ?? null}
                  onValueChange={(next) => form.setValue(`effortMap.${claudeEffort}`, next as Effort, SAVE_OPTIONS)}
                />
              </span>
            }
          />
        ))}
      </List>
    </Block>
  );
}

function ClaudeBlock({ form }: { form: ConfigForm }) {
  const agents: Record<string, ClaudeAgent> = useWatch({ control: form.control, name: 'claude.agents' }) ?? {};
  const taskTypes: Record<string, string> = useWatch({ control: form.control, name: 'claude.taskTypes' }) ?? {};
  const defaultAgent = useWatch({ control: form.control, name: 'claude.defaultAgent' });
  const agentNames = Object.keys(agents);
  const agentOptions = agentNames.map((name) => ({ value: name, label: name }));
  // null is a new agent; undefined means the dialog is closed.
  const [editingAgent, setEditingAgent] = useState<string | null | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTaskType, setNewTaskType] = useState('');

  const trimmedTaskType = newTaskType.trim();
  const taskTypeTaken = Object.hasOwn(taskTypes, trimmedTaskType);

  function openAgent(name: string | null) {
    setEditingAgent(name);
    setDialogOpen(true);
  }

  function setAgent(name: string, agent: ClaudeAgent) {
    form.setValue('claude.agents', { ...agents, [name]: agent }, SAVE_OPTIONS);
  }

  function removeAgent(name: string) {
    setDialogOpen(false);
    setEditingAgent(undefined);
    form.setValue('claude.agents', Object.fromEntries(Object.entries(agents).filter(([other]) => other !== name)), SAVE_OPTIONS);
  }

  function setTaskTypes(next: Record<string, string>) {
    form.setValue('claude.taskTypes', next, SAVE_OPTIONS);
  }

  function addTaskType(event: FormEvent) {
    event.preventDefault();
    if (trimmedTaskType === '' || taskTypeTaken) return;
    setTaskTypes({ ...taskTypes, [trimmedTaskType]: defaultAgent });
    setNewTaskType('');
  }

  function lockedReason(name: string) {
    if (name === defaultAgent) return 'This is the default agent. Choose another default before removing it.';
    if (Object.values(taskTypes).includes(name)) return 'Task types still use this agent. Point them at another agent first.';
    return undefined;
  }

  return (
    <Block
      id="claude-title"
      title="Claude agents"
      description="Tasks on the claude tier go to the agent named for their task type, or to the default agent."
      action={
        <Button variant="secondary" icon={<Plus aria-hidden="true" />} onClick={() => openAgent(null)}>
          Add agent
        </Button>
      }
    >
      <div className={styles.defaultRow}>
        <label className={styles.defaultLabel} htmlFor="claude-default-agent">
          Default agent
        </label>
        <Select
          mono
          id="claude-default-agent"
          className={styles.agentSelect}
          options={agentOptions}
          value={defaultAgent && agentNames.includes(defaultAgent) ? defaultAgent : null}
          emptyText="Add an agent first."
          onValueChange={(next) => form.setValue('claude.defaultAgent', next, SAVE_OPTIONS)}
        />
      </div>
      <List aria-label="Claude agents">
        {agentNames.length === 0 ? <ListEmpty>No agents yet. Add one to route tasks to the claude tier.</ListEmpty> : null}
        {agentNames.map((name) => (
          <ListRow
            key={name}
            title={<span className={styles.mono}>{name}</span>}
            subtitle={`${agents[name].model || 'no model'} · ${agents[name].effort}`}
            status={name === defaultAgent ? <Badge tone="info">Default</Badge> : undefined}
            invalid={agents[name].model.trim() === ''}
            onOpen={() => openAgent(name)}
            openLabel={`Edit agent ${name}`}
          />
        ))}
      </List>
      <h4 className={styles.subTitle}>Agent per task type</h4>
      <List aria-label="Agent per task type">
        {Object.keys(taskTypes).length === 0 ? <ListEmpty>No task types mapped. Every claude task uses the default agent.</ListEmpty> : null}
        {Object.entries(taskTypes).map(([taskType, agentName]) => (
          <ListRow
            key={taskType}
            title={<span className={styles.mono}>{taskType}</span>}
            trailing={
              <>
                <Select
                  mono
                  className={styles.agentSelect}
                  aria-label={`Agent for ${taskType}`}
                  options={agentOptions}
                  value={agentName}
                  onValueChange={(next) => setTaskTypes({ ...taskTypes, [taskType]: next })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={<X aria-hidden="true" />}
                  aria-label={`Remove task type ${taskType}`}
                  onClick={() => setTaskTypes(Object.fromEntries(Object.entries(taskTypes).filter(([other]) => other !== taskType)))}
                />
              </>
            }
          />
        ))}
      </List>
      <form className={styles.addTaskType} onSubmit={addTaskType}>
        <TextField
          mono
          className={styles.addField}
          label="New task type"
          autoComplete="off"
          spellCheck={false}
          value={newTaskType}
          error={taskTypeTaken ? 'This task type is already mapped.' : undefined}
          onChange={(event) => setNewTaskType(event.target.value)}
        />
        <Button type="submit" icon={<Plus aria-hidden="true" />} disabled={trimmedTaskType === '' || taskTypeTaken || agentNames.length === 0}>
          Add task type
        </Button>
      </form>
      {editingAgent !== undefined ? (
        <AgentDialog
          key={editingAgent ?? 'new-agent'}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          name={editingAgent}
          agents={agents}
          lockedReason={editingAgent === null ? undefined : lockedReason(editingAgent)}
          onChange={setAgent}
          onRemove={removeAgent}
        />
      ) : null}
    </Block>
  );
}
