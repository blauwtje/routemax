import { useState } from 'react';
import { CircleCheckIcon, CircleXIcon, FlaskConicalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { ProviderTestResult } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError, formatTime, formatUsd } from '@/lib/format';

interface ProviderTestPanelProps {
  providerId: string;
  models: string[];
  result: ProviderTestResult | undefined;
  dirty: boolean;
  onTested: () => void;
}

const SELECT_CLASS =
  'provider-test-panel-select h-8 min-w-0 flex-1 rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function TestResultLine({ result }: { result: ProviderTestResult | undefined }) {
  if (result === undefined) return <p className="text-sm text-muted-foreground">Never tested.</p>;
  const ResultIcon = result.passed ? CircleCheckIcon : CircleXIcon;
  return (
    <p className="flex items-start gap-2 text-sm">
      <ResultIcon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${result.passed ? 'text-status-done' : 'text-status-refused'}`} />
      <span className="min-w-0 break-words">
        {`${result.passed ? 'Last test passed' : 'Last test failed'} on ${result.model} at ${formatTime(result.testedAt)}, cost ${formatUsd(result.costUsd)}: ${result.detail}`}
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
    <div className="provider-test-panel flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={`test-${providerId}-model`}>Test</Label>
      <TestResultLine result={result} />
      <div className="flex gap-2">
        <select id={`test-${providerId}-model`} className={SELECT_CLASS} value={chosen} onChange={(event) => setModel(event.target.value)}>
          {models.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" disabled={running || dirty || chosen === ''} onClick={() => void runTest()}>
          <FlaskConicalIcon aria-hidden="true" />
          {running ? 'Testing…' : 'Run a paid test call'}
        </Button>
      </div>
      {dirty && <p className="text-sm text-muted-foreground">Save first: the test runs the saved config.</p>}
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
