import { useState } from 'react';
import { ArrowRightIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/field';
import { Input } from '@/components/ui/input';
import { SettingsGroup } from '@/components/settings-group';
import type { ConfigForm } from '@/hooks/use-config-form';
import { CopyButton } from './copy-button';

export function ProjectCommands({ form, className }: { form: ConfigForm; className?: string }) {
  const [newFolder, setNewFolder] = useState('');
  return (
    <Controller
      control={form.control}
      name="projects"
      render={({ field }) => (
        <SettingsGroup
          title="Project commands"
          description="The test command routemax runs in each project folder to verify a delegate change before handing control back."
          className={className}
        >
          {Object.keys(field.value ?? {}).length === 0 && (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          )}
          <div className="flex flex-col divide-y divide-border empty:hidden">
            {Object.entries(field.value ?? {}).map(([folder, project], index) => (
              <div
                key={folder}
                className="project-commands-row grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-2 py-3 first:pt-0 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
              >
                <span className="col-span-2 min-w-0 truncate pb-1.5 font-mono text-sm md:col-span-1 md:pb-2.5" title={folder}>
                  {folder}
                </span>
                <ArrowRightIcon aria-hidden="true" className="hidden size-4 shrink-0 self-center text-muted-foreground md:block md:pb-2" />
                <div className="col-span-2 flex items-end gap-1.5 md:col-span-1">
                  <Field label="Test command" htmlFor={`project-${index}-command`} className="min-w-0 flex-1">
                    <Input
                      autoComplete="off"
                      spellCheck={false}
                      data-mono
                      value={project.testCommand}
                      onChange={(event) =>
                        field.onChange({ ...field.value, [folder]: { testCommand: event.target.value } })
                      }
                    />
                  </Field>
                  <CopyButton value={project.testCommand} label={`${folder} test command`} className="mb-0.5" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-0.5 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${folder}`}
                  onClick={() =>
                    field.onChange(
                      Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== folder)),
                    )
                  }
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
          <div className="project-commands-add flex items-end gap-2 border-t border-border pt-4">
            <Field label="Project folder" htmlFor="project-new-folder" className="min-w-0 flex-1 md:max-w-md">
              <Input
                autoComplete="off"
                spellCheck={false}
                data-mono
                value={newFolder}
                onChange={(event) => setNewFolder(event.target.value.trim())}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              disabled={newFolder === '' || Object.hasOwn(field.value ?? {}, newFolder)}
              onClick={() => {
                field.onChange({ ...field.value, [newFolder]: { testCommand: '' } });
                setNewFolder('');
              }}
            >
              <PlusIcon aria-hidden="true" />
              Add project
            </Button>
          </div>
        </SettingsGroup>
      )}
    />
  );
}
