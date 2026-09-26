import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { ApiError } from '@/lib/api-client';
import type { ConfigResponse, DelegateConfig, SaveResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';
import { configIssues, configSchema } from '../../../src/config/config-schema';

export type ConfigFormValues = z.input<typeof configSchema>;
export type ConfigForm = UseFormReturn<ConfigFormValues, unknown, DelegateConfig>;

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; chezmoiMessage: string }
  | { kind: 'stale' }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'failed'; message: string };

interface LoadedBase {
  hash: string;
  previousExists: boolean;
}

const loadConfig = () => api.request<ConfigResponse>('GET', '/api/config');

function failureState(error: unknown): SaveState {
  if (error instanceof ApiError && error.status === 409) return { kind: 'stale' };
  if (error instanceof ApiError && error.status === 422) return { kind: 'invalid', issues: error.issues };
  return { kind: 'failed', message: describeError(error) };
}

export function useConfigForm() {
  const form = useForm<ConfigFormValues, unknown, DelegateConfig>({ resolver: zodResolver(configSchema) });
  const [base, setBase] = useState<LoadedBase | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });

  const reload = useCallback(() => {
    loadConfig().then(
      (response) => {
        form.reset(response.config);
        setBase({ hash: response.hash, previousExists: response.previousExists });
        setLoadError(null);
        setSaveState({ kind: 'idle' });
      },
      (error: unknown) => setLoadError(describeError(error)),
    );
  }, [form]);

  useEffect(reload, [reload]);

  const save = form.handleSubmit(
    async (config) => {
      if (base === null) return;
      setSaveState({ kind: 'saving' });
      try {
        const response = await api.request<SaveResponse>('PUT', '/api/config', { config, baseHash: base.hash });
        form.reset(config);
        setBase({ hash: response.hash, previousExists: true });
        setSaveState({ kind: 'saved', chezmoiMessage: response.chezmoi.message });
      } catch (error) {
        setSaveState(failureState(error));
      }
    },
    () => setSaveState({ kind: 'invalid', issues: configIssues(form.getValues()) }),
  );

  const restore = useCallback(async () => {
    if (base === null) return;
    setSaveState({ kind: 'saving' });
    try {
      const response = await api.request<SaveResponse>('POST', '/api/config/restore', { baseHash: base.hash });
      const fresh = await loadConfig();
      form.reset(fresh.config);
      setBase({ hash: fresh.hash, previousExists: fresh.previousExists });
      setSaveState({ kind: 'saved', chezmoiMessage: response.chezmoi.message });
    } catch (error) {
      setSaveState(failureState(error));
    }
  }, [base, form]);

  return { form, ready: base !== null, previousExists: base?.previousExists ?? false, loadError, saveState, save, restore, reload };
}
