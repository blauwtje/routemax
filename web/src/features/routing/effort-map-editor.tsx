import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';
import { SELECT_CLASS } from './tier-styles';

export function EffortMapEditor({ form }: { form: ConfigForm }) {
  return (
    <section aria-labelledby="effort-map-editor-title" className="effort-map-editor flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="effort-map-editor-title" className="font-heading text-lg font-bold tracking-tight">
          Effort map
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">The effort a task asks for on Claude, and the worker effort it maps to.</p>
      </div>
      <div className="effort-map-editor-grid grid grid-cols-2 gap-3 rounded-xl bg-card p-4 text-card-foreground shadow-(--shadow-card) sm:grid-cols-3 lg:grid-cols-5">
        {EFFORT_ORDER.map((claudeEffort) => (
          <div key={claudeEffort} className="flex flex-col gap-1.5">
            <Label htmlFor={`effort-map-${claudeEffort}`}>{claudeEffort}</Label>
            <select
              id={`effort-map-${claudeEffort}`}
              className={`effort-map-editor-select ${SELECT_CLASS}`}
              {...form.register(`effortMap.${claudeEffort}`)}
            >
              {EFFORT_ORDER.map((workerEffort) => (
                <option key={workerEffort} value={workerEffort}>
                  {workerEffort}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}
