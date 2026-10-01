import { FlaskConical, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useWatch } from 'react-hook-form';
import { Badge } from '@/components/badge/badge';
import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { Select } from '@/components/select/select';
import { Switch } from '@/components/switch/switch';
import { Tabs } from '@/components/tabs/tabs';
import { TextField } from '@/components/text-field/text-field';
import type { ConfigForm } from '@/hooks/use-config-form';
import type { ProviderTestResult } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError, formatTime, formatUsd } from '@/lib/format';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';
import styles from './provider-dialog.module.css';

const PROVIDER_ID = /^[a-z0-9-]+$/;
const CREATE_FORM_ID = 'provider-create-form';

const PRICE_FIELDS = [
  ['inputUsd', 'Input'],
  ['cacheHitUsd', 'Cache hit'],
  ['outputUsd', 'Output'],
] as const;

type PriceField = (typeof PRICE_FIELDS)[number][0];
type ModelPrice = Record<PriceField, number>;
type Effort = (typeof EFFORT_ORDER)[number];
type RepairProxy = { port: number; logPath: string; telemetryPath: string };

type ProviderDialogProps = {
  form: ConfigForm;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The provider being edited; null opens the dialog in create mode. */
  providerId: string | null;
  /** From GET /api/keys; undefined while it loads or when the poll failed. */
  keyPresent: boolean | undefined;
  lastTest: ProviderTestResult | undefined;
  /** Refresh the polled test results after a paid call. */
  onTested: () => void;
  /** Create mode committed a provider; the section swaps to edit mode on this id. */
  onCreated: (providerId: string) => void;
};

const numberValue = (value: number | undefined) => (value === undefined || Number.isNaN(value) ? '' : value);

export function ProviderDialog({ form, open, onOpenChange, providerId, keyPresent, lastTest, onTested, onCreated }: ProviderDialogProps) {
  const [tab, setTab] = useState('details');
  const providers = useWatch({ control: form.control, name: 'providers' });
  const creating = providerId === null;
  const provider = creating ? undefined : providers?.[providerId];
  if (!creating && provider === undefined) return null;

  const title = creating ? 'Add provider' : provider?.name || providerId;
  const tabs = [
    { value: 'details', label: 'Details', content: creating ? <CreatePanel form={form} onCreated={(id) => { setTab('models'); onCreated(id); }} /> : <DetailsPanel form={form} providerId={providerId} keyPresent={keyPresent} /> },
    { value: 'models', label: 'Models', disabled: creating, content: creating ? null : <ModelsPanel form={form} providerId={providerId} /> },
    {
      value: 'test',
      label: 'Test',
      disabled: creating,
      content: creating ? null : <TestPanel form={form} providerId={providerId} keyPresent={keyPresent} lastTest={lastTest} onTested={onTested} />,
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title={title}
      description={creating ? 'It starts disabled with no models, so no tier can use it until it has one.' : 'Changes save as you type.'}
      meta={creating ? undefined : providerId}
      footerStart={creating ? undefined : <RemoveProvider form={form} providerId={providerId} name={provider?.name ?? providerId} onRemoved={() => onOpenChange(false)} />}
      footerEnd={
        creating ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={CREATE_FORM_ID} icon={<Plus aria-hidden="true" />}>
              Add provider
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        )
      }
    >
      <Tabs items={tabs} value={creating ? 'details' : tab} onValueChange={setTab} aria-label="Provider sections" />
    </Dialog>
  );
}

function CreatePanel({ form, onCreated }: { form: ConfigForm; onCreated: (providerId: string) => void }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const taken = Object.hasOwn(form.getValues('providers') ?? {}, id);
  const idProblem = id === '' ? undefined : !PROVIDER_ID.test(id) ? 'Use lowercase letters, digits and dashes.' : taken ? 'A provider with this id exists.' : undefined;
  const urlProblem = baseUrl === '' || URL.canParse(baseUrl) ? undefined : 'Enter a full URL, for example https://api.example.com/v1.';
  const complete = id !== '' && idProblem === undefined && name.trim() !== '' && baseUrl !== '' && urlProblem === undefined;

  function add(event: FormEvent) {
    event.preventDefault();
    if (!complete) return;
    form.setValue(
      `providers.${id}`,
      { name: name.trim(), baseUrl, keyVariable: `${id.toUpperCase().replaceAll('-', '_')}_API_KEY`, models: {}, efforts: [...EFFORT_ORDER], enabled: false, repairProxy: null },
      { shouldDirty: true },
    );
    onCreated(id);
  }

  return (
    <form id={CREATE_FORM_ID} className={styles.fields} onSubmit={add}>
      <TextField label="Id" mono autoComplete="off" spellCheck={false} value={id} error={idProblem} description="Lowercase letters, digits and dashes. It cannot change later." onChange={(event) => setId(event.target.value.trim())} />
      <TextField label="Name" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
      <TextField label="Base URL" mono type="url" autoComplete="off" spellCheck={false} value={baseUrl} error={urlProblem} className={styles.wide} onChange={(event) => setBaseUrl(event.target.value.trim())} />
    </form>
  );
}

function DetailsPanel({ form, providerId, keyPresent }: { form: ConfigForm; providerId: string; keyPresent: boolean | undefined }) {
  const path = `providers.${providerId}` as const;
  const provider = useWatch({ control: form.control, name: path });
  const efforts: readonly Effort[] = provider.efforts;
  const proxy: RepairProxy | null = provider.repairProxy;
  const edit = { shouldDirty: true } as const;

  function toggleEffort(effort: Effort, on: boolean) {
    const next = EFFORT_ORDER.filter((kept) => (kept === effort ? on : efforts.includes(kept)));
    form.setValue(`${path}.efforts`, next, edit);
  }

  function setProxy(next: RepairProxy | null) {
    form.setValue(`${path}.repairProxy`, next, edit);
  }

  const keyNote =
    keyPresent === undefined ? 'Checking keys.env.' : keyPresent ? 'Key found in ~/.config/routemax/keys.env.' : 'Not set. Add it to ~/.config/routemax/keys.env, never to the config file.';

  return (
    <div className={styles.stack}>
      <div className={styles.fields}>
        <TextField label="Name" autoComplete="off" value={provider.name} error={provider.name.trim() === '' ? 'A name is required.' : undefined} onChange={(event) => form.setValue(`${path}.name`, event.target.value, edit)} />
        <TextField
          label="Key variable"
          mono
          autoComplete="off"
          spellCheck={false}
          value={provider.keyVariable ?? ''}
          description={keyNote}
          onChange={(event) => form.setValue(`${path}.keyVariable`, event.target.value, edit)}
        />
        <TextField
          label="Base URL"
          mono
          type="url"
          autoComplete="off"
          spellCheck={false}
          value={provider.baseUrl}
          error={URL.canParse(provider.baseUrl) ? undefined : 'Enter a full URL.'}
          className={styles.wide}
          onChange={(event) => form.setValue(`${path}.baseUrl`, event.target.value.trim(), edit)}
        />
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Efforts it accepts</legend>
        <div className={styles.chips}>
          {EFFORT_ORDER.map((effort) => (
            <label key={effort} className={styles.chip}>
              <input type="checkbox" className="visually-hidden" checked={efforts.includes(effort)} onChange={(event) => toggleEffort(effort, event.target.checked)} />
              <span>{effort}</span>
            </label>
          ))}
        </div>
        {efforts.length === 0 ? <p className={styles.problem}>Keep at least one effort.</p> : null}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Repair proxy</legend>
        <Switch
          checked={proxy !== null}
          onCheckedChange={(on) => setProxy(on ? { port: Number.NaN, logPath: '', telemetryPath: '' } : null)}
          label="Route this provider through the repair proxy"
          stateText={{ on: 'On', off: 'Off' }}
        />
        {proxy === null ? null : (
          <div className={styles.proxyFields}>
            <TextField label="Port" mono type="number" min={1} max={65535} inputMode="numeric" value={numberValue(proxy.port)} error={Number.isInteger(proxy.port) && proxy.port >= 1 && proxy.port <= 65535 ? undefined : 'A port from 1 to 65535.'} onChange={(event) => setProxy({ ...proxy, port: event.target.valueAsNumber })} />
            <TextField label="Log path" mono spellCheck={false} value={proxy.logPath} error={proxy.logPath === '' ? 'Required.' : undefined} onChange={(event) => setProxy({ ...proxy, logPath: event.target.value })} />
            <TextField label="Telemetry path" mono spellCheck={false} value={proxy.telemetryPath} error={proxy.telemetryPath === '' ? 'Required.' : undefined} onChange={(event) => setProxy({ ...proxy, telemetryPath: event.target.value })} />
          </div>
        )}
      </fieldset>
    </div>
  );
}

function ModelsPanel({ form, providerId }: { form: ConfigForm; providerId: string }) {
  const path = `providers.${providerId}.models` as const;
  const models: Record<string, ModelPrice> = useWatch({ control: form.control, name: path }) ?? {};
  const [draft, setDraft] = useState('');
  const names = Object.keys(models);
  const name = draft.trim();
  const duplicate = names.includes(name);
  const edit = { shouldDirty: true } as const;

  function addModel(event: FormEvent) {
    event.preventDefault();
    if (name === '' || duplicate) return;
    // New prices start empty (NaN) so a model cannot be billed at a price nobody typed.
    form.setValue(path, { ...models, [name]: { inputUsd: Number.NaN, cacheHitUsd: Number.NaN, outputUsd: Number.NaN } }, edit);
    setDraft('');
  }

  function removeModel(model: string) {
    const { [model]: _removed, ...rest } = models;
    form.setValue(path, rest, edit);
  }

  function setPrice(model: string, field: PriceField, value: number) {
    form.setValue(`${path}.${model}.${field}`, value, edit);
  }

  return (
    <div className={styles.stack}>
      <p className={styles.note}>USD per 1M tokens. A model needs all three prices before a tier can use it.</p>
      {names.length === 0 ? (
        <p className={styles.empty}>No models yet. Add the first model id this provider serves.</p>
      ) : (
        <ul className={styles.models} aria-label="Models and prices">
          {names.map((model) => (
            <li key={model} className={styles.model}>
              <div className={styles.modelHead}>
                <span className={styles.modelName}>{model}</span>
                <Button variant="ghost" size="sm" iconOnly icon={<Trash2 aria-hidden="true" />} aria-label={`Remove ${model}`} onClick={() => removeModel(model)} />
              </div>
              <div className={styles.prices}>
                {PRICE_FIELDS.map(([field, label]) => {
                  const price = models[model][field];
                  const invalid = Number.isNaN(price) || price < 0;
                  return (
                    <TextField
                      key={field}
                      label={label}
                      aria-label={`${model} ${label} price`}
                      mono
                      prefix="$"
                      type="number"
                      step="any"
                      min={0}
                      inputMode="decimal"
                      value={numberValue(price)}
                      error={invalid ? 'Enter a price.' : undefined}
                      onChange={(event) => setPrice(model, field, event.target.valueAsNumber)}
                    />
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className={styles.addModel} onSubmit={addModel}>
        <TextField
          label="Model id"
          mono
          autoComplete="off"
          spellCheck={false}
          value={draft}
          error={duplicate ? 'This model is already listed.' : undefined}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="secondary" icon={<Plus aria-hidden="true" />} disabled={name === '' || duplicate}>
          Add model
        </Button>
      </form>
    </div>
  );
}

type TestPanelProps = { form: ConfigForm; providerId: string; keyPresent: boolean | undefined; lastTest: ProviderTestResult | undefined; onTested: () => void };

function TestPanel({ form, providerId, keyPresent, lastTest, onTested }: TestPanelProps) {
  const models: Record<string, ModelPrice> = useWatch({ control: form.control, name: `providers.${providerId}.models` }) ?? {};
  const names = Object.keys(models);
  const [picked, setPicked] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const model = names.includes(picked) ? picked : (names[0] ?? '');
  const blocked = names.length === 0 ? 'Add a model first.' : keyPresent === false ? 'The key variable is not set, so the call would fail before it is billed.' : null;

  async function run() {
    setRunning(true);
    setError(null);
    try {
      await api.request<ProviderTestResult>('POST', `/api/providers/${encodeURIComponent(providerId)}/test`, { model });
      onTested();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={styles.stack}>
      <p className={styles.note}>A test call is real and billed to this provider. It runs against the saved configuration, and its cost is shown with the result.</p>
      <div className={styles.testRow}>
        <div className={styles.testModel}>
          <span className={styles.legend} id={`test-model-${providerId}`}>
            Model
          </span>
          <Select
            mono
            aria-label="Model for the test call"
            value={model === '' ? null : model}
            options={names.map((name) => ({ value: name, label: name }))}
            onValueChange={setPicked}
            emptyText="No models yet."
            disabled={names.length === 0}
          />
        </div>
        <Button variant="primary" icon={<FlaskConical aria-hidden="true" />} loading={running} disabled={blocked !== null} onClick={() => void run()}>
          {running ? 'Testing' : 'Run paid test'}
        </Button>
      </div>
      {blocked === null ? null : <p className={styles.note}>{blocked}</p>}
      {error === null ? null : (
        <p className={styles.problem} role="alert">
          {error}
        </p>
      )}
      <section className={styles.result} aria-label="Last test" aria-live="polite" data-passed={lastTest?.passed}>
        {lastTest === undefined ? (
          <p className={styles.note}>Never tested.</p>
        ) : (
          <>
            <div className={styles.resultHead}>
              <Badge tone={lastTest.passed ? 'ok' : 'danger'}>{lastTest.passed ? 'Passed' : 'Failed'}</Badge>
              <span className={styles.mono}>{lastTest.model}</span>
              <span className={styles.mono}>{formatTime(lastTest.testedAt)}</span>
              <span className={styles.mono}>{formatUsd(lastTest.costUsd)}</span>
            </div>
            <p className={styles.detail}>{lastTest.detail}</p>
          </>
        )}
      </section>
    </div>
  );
}

function RemoveProvider({ form, providerId, name, onRemoved }: { form: ConfigForm; providerId: string; name: string; onRemoved: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const usedBy = Object.entries(form.getValues('tiers') ?? {})
    .filter(([, tier]) => tier.provider === providerId)
    .map(([tierName]) => tierName);

  function remove() {
    const providers = { ...form.getValues('providers') };
    delete providers[providerId];
    form.setValue('providers', providers, { shouldDirty: true });
    setConfirming(false);
    onRemoved();
  }

  return (
    <>
      <Button variant="danger" icon={<Trash2 aria-hidden="true" />} onClick={() => setConfirming(true)}>
        Remove provider
      </Button>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Remove ${name}?`}
        description={
          usedBy.length === 0
            ? 'It leaves the config. Undo from the toast restores it.'
            : `Used by ${usedBy.join(', ')}. The config stays invalid and will not save until those tiers point at another provider.`
        }
        footerEnd={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep provider
            </Button>
            <Button variant="danger" onClick={remove}>
              Remove provider
            </Button>
          </>
        }
      >
        <p className={styles.note}>Its models and prices are removed with it.</p>
      </Dialog>
    </>
  );
}
