import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import type { ConfigResponse, DelegateConfig } from '@/lib/api-types';
import { createAutosaveQueue, type AutosaveQueue, type AutosaveState } from '@/lib/autosave-queue';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';
import { configIssues, configSchema } from '../../../src/config/config-schema';

export type ConfigFormValues = z.input<typeof configSchema>;
export type ConfigForm = UseFormReturn<ConfigFormValues, unknown, DelegateConfig>;

export type SaveState = AutosaveState;

const loadConfig = () => api.request<ConfigResponse>('GET', '/api/config');

export function useConfigForm() {
  const form = useForm<ConfigFormValues, unknown, DelegateConfig>({ resolver: zodResolver(configSchema) });
  const [queue, setQueue] = useState<AutosaveQueue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });

  const reload = useCallback(() => {
    loadConfig().then(
      (response) => {
        form.reset(response.config);
        setQueue(createAutosaveQueue(api, response.hash));
        setLoadError(null);
        setSaveState({ kind: 'idle' });
      },
      (error: unknown) => setLoadError(describeError(error)),
    );
  }, [form]);

  useEffect(reload, [reload]);

  useEffect(() => {
    if (queue === null) return;
    const stopState = queue.subscribe(setSaveState);
    // A watch callback without a field name comes from form.reset, which is a load or an undo, not an edit.
    const subscription = form.watch((_values, { name }) => {
      if (name === undefined) return;
      void form.handleSubmit(
        (config) => {
          setSaveState((current) => (current.kind === 'invalid' ? queue.state() : current));
          queue.change(config);
        },
        () => setSaveState({ kind: 'invalid', issues: configIssues(form.getValues()) }),
      )();
    });
    return () => {
      stopState();
      subscription.unsubscribe();
    };
  }, [form, queue]);

  const undo = useCallback(async () => {
    if (queue === null) return;
    await queue.undo();
    if (queue.state().kind !== 'saved') return;
    try {
      const fresh = await loadConfig();
      form.reset(fresh.config);
    } catch (error) {
      setSaveState({ kind: 'failed', message: describeError(error) });
    }
  }, [queue, form]);

  return { form, ready: queue !== null, loadError, saveState, undo, reload };
}
