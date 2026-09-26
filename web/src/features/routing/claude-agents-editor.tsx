import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER, type Effort } from '../../../../src/config/config-schema';

const SELECT_CLASS =
  'claude-agents-editor-select h-8 w-full rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';
const CARD_CLASS = 'flex flex-col divide-y rounded-xl bg-card px-4 text-card-foreground shadow-(--shadow-card)';
const REMOVE_CLASS = 'text-muted-foreground hover:text-destructive';

export function ClaudeAgentsEditor({ form }: { form: ConfigForm }) {
  const agents = useWatch({ control: form.control, name: 'claude.agents' }) ?? {};
  const agentNames = Object.keys(agents);
  const [newAgent, setNewAgent] = useState('');
  const [newTaskType, setNewTaskType] = useState('');

  return (
    <section aria-labelledby="claude-agents-editor-title" className="claude-agents-editor flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="claude-agents-editor-title" className="font-heading text-lg font-bold tracking-tight">
          Claude agents
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          Tasks on the claude tier go to the agent named for their task type, or to the default agent.
        </p>
      </div>
      <Controller
        control={form.control}
        name="claude.agents"
        render={({ field }) => (
          <div className={CARD_CLASS}>
            {Object.entries(field.value ?? {}).map(([name, agent]) => (
              <div key={name} className="claude-agents-editor-row grid gap-3 py-4 md:grid-cols-[10rem_1fr_8rem_auto] md:items-end">
                <span className="font-heading font-bold break-words md:flex md:h-8 md:items-center">{name}</span>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`agent-${name}-model`}>Model</Label>
                  <Input
                    id={`agent-${name}-model`}
                    autoComplete="off"
                    spellCheck={false}
                    value={agent.model}
                    onChange={(event) => field.onChange({ ...field.value, [name]: { ...agent, model: event.target.value } })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`agent-${name}-effort`}>Effort</Label>
                  <select
                    id={`agent-${name}-effort`}
                    className={SELECT_CLASS}
                    value={agent.effort}
                    onChange={(event) => field.onChange({ ...field.value, [name]: { ...agent, effort: event.target.value as Effort } })}
                  >
                    {EFFORT_ORDER.map((effort) => (
                      <option key={effort} value={effort}>
                        {effort}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={REMOVE_CLASS}
                  onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== name)))}
                >
                  <Trash2Icon aria-hidden="true" />
                  Remove agent
                </Button>
              </div>
            ))}
            <div className="claude-agents-editor-add flex flex-wrap items-end gap-2 py-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-new-name">New agent</Label>
                <Input id="agent-new-name" autoComplete="off" spellCheck={false} value={newAgent} onChange={(event) => setNewAgent(event.target.value.trim())} />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={newAgent === '' || Object.hasOwn(field.value ?? {}, newAgent)}
                onClick={() => {
                  field.onChange({ ...field.value, [newAgent]: { model: '', effort: 'medium' } });
                  setNewAgent('');
                }}
              >
                <PlusIcon aria-hidden="true" />
                Add agent
              </Button>
            </div>
          </div>
        )}
      />
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="claude-default-agent">Default agent</Label>
        <select id="claude-default-agent" className={SELECT_CLASS} {...form.register('claude.defaultAgent')}>
          {agentNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <h3 className="font-heading font-bold">Agent per task type</h3>
      <Controller
        control={form.control}
        name="claude.taskTypes"
        render={({ field }) => (
          <div className={CARD_CLASS}>
            {Object.entries(field.value ?? {}).map(([taskType, agentName]) => (
              <div key={taskType} className="claude-agents-editor-row grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 py-3 md:grid-cols-[10rem_1fr_auto]">
                <Label htmlFor={`task-type-${taskType}`} className="col-span-2 break-all md:col-span-1">
                  {taskType}
                </Label>
                <select
                  id={`task-type-${taskType}`}
                  className={SELECT_CLASS}
                  value={agentName}
                  onChange={(event) => field.onChange({ ...field.value, [taskType]: event.target.value })}
                >
                  {agentNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={REMOVE_CLASS}
                  aria-label={`Remove ${taskType}`}
                  onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== taskType)))}
                >
                  <Trash2Icon aria-hidden="true" />
                  Remove
                </Button>
              </div>
            ))}
            <div className="claude-agents-editor-add flex flex-wrap items-end gap-2 py-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-type-new">New task type</Label>
                <Input id="task-type-new" autoComplete="off" spellCheck={false} value={newTaskType} onChange={(event) => setNewTaskType(event.target.value.trim())} />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={newTaskType === '' || Object.hasOwn(field.value ?? {}, newTaskType)}
                onClick={() => {
                  field.onChange({ ...field.value, [newTaskType]: form.getValues('claude.defaultAgent') });
                  setNewTaskType('');
                }}
              >
                <PlusIcon aria-hidden="true" />
                Add task type
              </Button>
            </div>
          </div>
        )}
      />
    </section>
  );
}
