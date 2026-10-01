import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { Badge } from '@/components/badge/badge';
import { Button } from '@/components/button/button';
import { List, ListEmpty, ListRow, ListSkeleton } from '@/components/list/list';
import { Switch } from '@/components/switch/switch';
import type { ConfigForm } from '@/hooks/use-config-form';
import { usePoll } from '@/hooks/use-poll';
import type { KeysResponse, ProviderTestResult, ProviderTestsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { formatTime } from '@/lib/format';
import { ProviderDialog } from './provider-dialog';
import styles from './provider-section.module.css';

const loadKeys = () => api.request<KeysResponse>('GET', '/api/keys');
const loadProviderTests = () => api.request<ProviderTestsResponse>('GET', '/api/provider-tests');

/** null = closed, 'new' = create mode, anything else = the provider id being edited. */
type Target = string | null;
const CREATE = '\u0000new';

export function ProviderSection({ form }: { form: ConfigForm }) {
  const providers = useWatch({ control: form.control, name: 'providers' });
  const keys = usePoll(loadKeys);
  const tests = usePoll(loadProviderTests);
  const [target, setTarget] = useState<Target>(null);
  const ids = Object.keys(providers ?? {});

  const keyPresent = (id: string): boolean | undefined =>
    keys.state.kind === 'loaded' && Object.hasOwn(keys.state.value.keys, id) ? keys.state.value.keys[id].present : undefined;
  const lastTest = (id: string): ProviderTestResult | undefined =>
    tests.state.kind === 'loaded' && Object.hasOwn(tests.state.value, id) ? tests.state.value[id] : undefined;
  const pollProblem = keys.state.kind === 'failed' || tests.state.kind === 'failed';

  function retry() {
    keys.refresh();
    tests.refresh();
  }

  return (
    <section className={styles.section} aria-labelledby="routing-providers-title">
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 id="routing-providers-title" className={styles.title}>
            Providers
          </h2>
          <p className={styles.lede}>Where tiers send work. Keys live in ~/.config/routemax/keys.env, never in the config file.</p>
        </div>
        <Button variant="secondary" icon={<Plus aria-hidden="true" />} onClick={() => setTarget(CREATE)}>
          Add provider
        </Button>
      </header>

      {pollProblem ? (
        <p className={styles.problem} role="status">
          Key and test status are unavailable.{' '}
          <button type="button" className={styles.retry} onClick={retry}>
            Retry
          </button>
        </p>
      ) : null}

      {providers === undefined ? (
        <ListSkeleton rows={3} />
      ) : (
        <List aria-label="Providers">
          {ids.length === 0 ? <ListEmpty>No providers yet. Add one to give a tier somewhere to send tasks.</ListEmpty> : null}
          {ids.map((id) => {
            const provider = providers[id];
            const test = lastTest(id);
            const present = keyPresent(id);
            return (
              <ListRow
                key={id}
                title={provider.name || id}
                subtitle={`${provider.baseUrl} · ${provider.keyVariable ?? 'no key variable'}`}
                openLabel={`Edit ${provider.name || id}`}
                onOpen={() => setTarget(id)}
                status={
                  <span className={styles.badges}>
                    {present === undefined ? <Badge tone={keys.state.kind === 'failed' ? 'neutral' : 'busy'}>{keys.state.kind === 'failed' ? 'Key unknown' : 'Key checking'}</Badge> : <Badge tone={present ? 'ok' : 'warn'}>{present ? 'Key set' : 'No key'}</Badge>}
                    {test === undefined ? (
                      <Badge tone={tests.state.kind === 'loading' ? 'busy' : 'neutral'}>{tests.state.kind === 'loading' ? 'Test checking' : 'Never tested'}</Badge>
                    ) : (
                      <Badge tone={test.passed ? 'ok' : 'danger'} title={formatTime(test.testedAt)}>
                        {test.passed ? 'Test passed' : 'Test failed'}
                      </Badge>
                    )}
                  </span>
                }
                trailing={
                  <Switch
                    checked={provider.enabled}
                    onCheckedChange={(enabled) => form.setValue(`providers.${id}.enabled`, enabled, { shouldDirty: true })}
                    aria-label={`${provider.name || id} enabled`}
                    stateText={{ on: 'On', off: 'Off' }}
                  />
                }
              />
            );
          })}
        </List>
      )}

      {target === null ? null : (
        <ProviderDialog
          form={form}
          open
          onOpenChange={(open) => {
            if (!open) setTarget(null);
          }}
          providerId={target === CREATE ? null : target}
          keyPresent={target === CREATE ? undefined : keyPresent(target)}
          lastTest={target === CREATE ? undefined : lastTest(target)}
          onTested={tests.refresh}
          onCreated={setTarget}
        />
      )}
    </section>
  );
}
