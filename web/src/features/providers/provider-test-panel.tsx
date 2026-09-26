import { useState } from 'react';
import { CheckIcon, FlaskConicalIcon, Loader2Icon, XIcon } from 'lucide-react';
import { SettingsGroup } from '@/components/settings-group';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { ProviderTestResult } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { cn } from '@/lib/utils';
import { describeError, formatTime, formatUsd } from '@/lib/format';

interface ProviderTestPanelProps {
  providerId: string;
  models: string[];
  result: ProviderTestResult | undefined;
  dirty: boolean;
  onTested: () => void;
}

function TestResultLine({ result }: { result: ProviderTestResult | undefined }) {
  if (result === undefined) return <p className="text-sm text-muted-foreground">Never tested.</p>;
  const Icon = result.passed ? CheckIcon : XIcon;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5">
        <Icon
          key={result.testedAt}
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 motion-safe:scale-100 motion-safe:transition-transform motion-safe:duration-(--dur-panel) motion-safe:ease-(--ease-spring) motion-safe:starting:scale-0',
            result.passed ? 'text-status-positive' : 'text-status-negative',
          )}
        />
        <span className={result.passed ? 'font-medium text-status-positive' : 'font-medium text-status-negative'}>{result.passed ? 'Passed' : 'Failed'}</span>
      </span>
      <span className="min-w-0 break-words">
        {`on ${result.model} at ${formatTime(result.testedAt)}, cost `}
        <span className="font-mono tabular-nums">{formatUsd(result.costUsd)}</span>
        {`: ${result.detail}`}
      </span>
    </p>
  );
}

export function ProviderTestPanel({ providerId, models, result, dirty, onTested }: ProviderTestPanelProps) {
  const [model, setModel] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = models.includes(model) ? model : (models[0] ?? '');

  async function runTest() {
    setRunning(true);
    setError(null);
    try {
      await api.request<ProviderTestResult>('POST', `/api/providers/${encodeURIComponent(providerId)}/test`, { model: chosen });
      onTested();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setRunning(false);
    }
  }

  return (
    <SettingsGroup title="Test call">
      <div className="provider-test-panel flex flex-col gap-3">
        <TestResultLine result={result} />
        <div className="flex flex-col gap-2">
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            <Label htmlFor={`test-${providerId}-model`}>Model</Label>
            <NativeSelect id={`test-${providerId}-model`} value={chosen} onChange={(event) => setModel(event.target.value)}>
              {models.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="button" variant="outline" className="self-start" disabled={running || dirty || chosen === ''} onClick={() => void runTest()}>
            {running ? <Loader2Icon aria-hidden="true" className="motion-safe:animate-spin" /> : <FlaskConicalIcon aria-hidden="true" />}
            {running ? 'Testing…' : 'Run a paid test call'}
          </Button>
        </div>
        {dirty && <p className="text-sm text-muted-foreground">Save first: the test runs the saved config, and this call is billed.</p>}
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </SettingsGroup>
  );
}
