import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SettingsGroup } from '@/components/settings-group';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

export function EffortMapEditor({ form }: { form: ConfigForm }) {
  return (
    <SettingsGroup className="border-t-0 pt-0" title="Effort map">
      <div className="max-w-[420px]">
        <Table className="effort-map-editor-table">
          <TableHeader>
            <TableRow>
              <TableHead>Claude effort</TableHead>
              <TableHead>Worker effort</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {EFFORT_ORDER.map((claudeEffort) => (
              <TableRow key={claudeEffort}>
                <TableCell className="font-mono">{claudeEffort}</TableCell>
                <TableCell>
                  <NativeSelect size="compact" aria-label={`Worker effort for ${claudeEffort}`} {...form.register(`effortMap.${claudeEffort}`)}>
                    {EFFORT_ORDER.map((workerEffort) => (
                      <option key={workerEffort} value={workerEffort}>
                        {workerEffort}
                      </option>
                    ))}
                  </NativeSelect>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SettingsGroup>
  );
}
