import { useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';

export function ProjectCommands({ form }: { form: ConfigForm }) {
  const [newFolder, setNewFolder] = useState('');
  return (
    <Controller
      control={form.control}
      name="projects"
      render={({ field }) => (
        <section aria-labelledby="project-commands-title" className="project-commands flex flex-col gap-4">
          <h2 id="project-commands-title" className="font-heading text-lg font-bold tracking-tight">
            Test command per project
          </h2>
          <div className="flex flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground shadow-(--shadow-card)">
            {Object.keys(field.value ?? {}).length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
            <div className="flex flex-col divide-y divide-border empty:hidden">
              {Object.entries(field.value ?? {}).map(([folder, project], index) => (
                <div key={folder} className="project-commands-row grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-2 py-3 first:pt-0 md:grid-cols-[1fr_1fr_auto]">
                  <span className="col-span-2 min-w-0 truncate font-mono text-sm md:col-span-1 md:pb-1.5" title={folder}>
                    {folder}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={`project-${index}-command`}>Test command</Label>
                    <Input
                      id={`project-${index}-command`}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono"
                      value={project.testCommand}
                      onChange={(event) => field.onChange({ ...field.value, [folder]: { testCommand: event.target.value } })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${folder}`}
                    onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== folder)))}
                  >
                    <Trash2Icon aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div className="project-commands-add flex items-end gap-2 border-t border-border pt-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:max-w-md">
                <Label htmlFor="project-new-folder">Project folder</Label>
                <Input id="project-new-folder" autoComplete="off" spellCheck={false} className="font-mono" value={newFolder} onChange={(event) => setNewFolder(event.target.value.trim())} />
              </div>
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
          </div>
        </section>
      )}
    />
  );
}
