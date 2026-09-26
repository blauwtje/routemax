import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { SettingsGroup } from '@/components/settings-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER, type Effort } from '../../../../src/config/config-schema';

const REMOVE_CLASS = 'text-muted-foreground hover:text-destructive';

export function ClaudeAgentsEditor({ form }: { form: ConfigForm }) {
  const agents = useWatch({ control: form.control, name: 'claude.agents' }) ?? {};
  const agentNames = Object.keys(agents);
  const [newAgent, setNewAgent] = useState('');
  const [newTaskType, setNewTaskType] = useState('');

  return (
    <SettingsGroup
      className="border-t-0 pt-0"
      title="Claude agents"
      description="Tasks on the claude tier go to the agent named for their task type, or to the default agent."
    >
      <Controller
        control={form.control}
        name="claude.agents"
        render={({ field }) => (
          <Table className="claude-agents-editor-table">
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="w-28">Effort</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(field.value ?? {}).map(([name, agent]) => (
                <TableRow key={name} className="claude-agents-editor-row">
                  <TableCell className="font-semibold break-words">{name}</TableCell>
                  <TableCell>
                    <Field label="Model" htmlFor={`agent-${name}-model`} className="[&_label]:sr-only">
                      <Input
                        autoComplete="off"
                        spellCheck={false}
                        value={agent.model}
                        onChange={(event) => field.onChange({ ...field.value, [name]: { ...agent, model: event.target.value } })}
                      />
                    </Field>
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      size="compact"
                      aria-label={`Effort for ${name}`}
                      value={agent.effort}
                      onChange={(event) => field.onChange({ ...field.value, [name]: { ...agent, effort: event.target.value as Effort } })}
                    >
                      {EFFORT_ORDER.map((effort) => (
                        <option key={effort} value={effort}>
                          {effort}
                        </option>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={REMOVE_CLASS}
                      aria-label={`Remove agent ${name}`}
                      onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== name)))}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="claude-agents-editor-add">
                <TableCell colSpan={3}>
                  <Field label="New agent" htmlFor="agent-new-name">
                    <Input autoComplete="off" spellCheck={false} value={newAgent} onChange={(event) => setNewAgent(event.target.value.trim())} />
                  </Field>
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      />
      <div className="mt-4 max-w-xs">
        <Field label="Default agent" htmlFor="claude-default-agent">
          <NativeSelect {...form.register('claude.defaultAgent')}>
            {agentNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <h3 className="mt-2 text-[13px] font-semibold text-foreground">Agent per task type</h3>
      <Controller
        control={form.control}
        name="claude.taskTypes"
        render={({ field }) => (
          <Table className="claude-task-types-table">
            <TableHeader>
              <TableRow>
                <TableHead>Task type</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(field.value ?? {}).map(([taskType, agentName]) => (
                <TableRow key={taskType} className="claude-agents-editor-row">
                  <TableCell className="font-semibold break-all">{taskType}</TableCell>
                  <TableCell>
                    <NativeSelect
                      size="compact"
                      aria-label={`Agent for ${taskType}`}
                      value={agentName}
                      onChange={(event) => field.onChange({ ...field.value, [taskType]: event.target.value })}
                    >
                      {agentNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={REMOVE_CLASS}
                      aria-label={`Remove ${taskType}`}
                      onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== taskType)))}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="claude-agents-editor-add">
                <TableCell colSpan={2}>
                  <Field label="New task type" htmlFor="task-type-new">
                    <Input autoComplete="off" spellCheck={false} value={newTaskType} onChange={(event) => setNewTaskType(event.target.value.trim())} />
                  </Field>
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      />
    </SettingsGroup>
  );
}
