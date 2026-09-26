import { Fragment } from 'react';
import { AdvancedSection } from '@/components/advanced-section';
import { SaveBar } from '@/components/save-bar';
import { SettingsGroup } from '@/components/settings-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useConfigForm, type ConfigForm } from '@/hooks/use-config-form';
import { usePoll } from '@/hooks/use-poll';
import type { ProviderTestsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { getTierColors } from '@/lib/tier-colors';
import { Controller, useWatch } from 'react-hook-form';
import { TIER_ORDER } from '../../../../src/config/config-schema';
import { ClaudeAgentsEditor } from './claude-agents-editor';
import { EffortMapEditor } from './effort-map-editor';
import { RoutePreview } from './route-preview';
import { RuleEditor } from './rule-editor';
import { TierEditor } from './tier-editor';
import { tierWarnings } from './tier-warnings';

const loadProviderTests = () => api.request<ProviderTestsResponse>('GET', '/api/provider-tests');

// The ladder is a decorative summary of tier order; the TierEditor table below is the
// authoritative, fully accessible source for each tier's provider/model/effort.
function TierLadder() {
  return (
    <div
      className="tier-ladder flex items-center"
      role="img"
      aria-label={`Tier ladder, in order of escalation: ${TIER_ORDER.join(', ')}`}
    >
      {TIER_ORDER.map((tier, i) => {
        const colors = getTierColors(tier);
        return (
          <Fragment key={tier}>
            <div aria-hidden="true" className="tier-ladder-node flex min-w-0 shrink-0 flex-col items-center gap-1.5">
              <span className={`tier-ladder-dot size-7 shrink-0 rounded-full shadow-[0_0_10px_currentColor] ${colors.dot} ${colors.text}`} />
              <span className="max-w-16 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-muted-foreground">{tier}</span>
            </div>
            {i < TIER_ORDER.length - 1 && (
              <div
                aria-hidden="true"
                className="tier-ladder-connector relative h-1 min-w-3 flex-1 -translate-y-2.5 overflow-hidden rounded-full"
                style={{ background: `linear-gradient(to right, var(--tier-${tier}), var(--tier-${TIER_ORDER[i + 1]}))` }}
              >
                <span
                  className="tier-ladder-pulse absolute inset-y-0 w-12 opacity-0"
                  style={{ background: 'linear-gradient(to right, transparent, white, transparent)' }}
                />
              </div>
            )}
          </Fragment>
        );
      })}
      <style>{`
        @keyframes tier-ladder-pulse-travel {
          from { transform: translateX(-3rem); }
          to { transform: translateX(calc(100% + 3rem)); }
        }
        @media (prefers-reduced-motion: no-preference) {
          html[data-router="on"] .tier-ladder-pulse {
            opacity: 0.9;
            animation: tier-ladder-pulse-travel 2.2s var(--ease-out-expo) infinite;
          }
        }
      `}</style>
    </div>
  );
}

const SMART_ROUTING_DEFAULT = { enabled: true, checkTimeoutMs: 3000 };

function SmartRoutingSwitch({ form }: { form: ConfigForm }) {
  return (
    <SettingsGroup
      className="border-t-0 pt-0"
      title="Smart routing"
      description="Scores each task's text to pick its tier, model and effort. Only an unclear task gets a paid check by the cheapest DeepSeek model. Rules that keep a task on Claude still win. Off: the rules decide alone."
    >
      <Controller
        control={form.control}
        name="smartRouting"
        render={({ field }) => {
          // A config saved before smart routing existed has no object; the schema's default applies.
          const smartRouting = field.value ?? SMART_ROUTING_DEFAULT;
          return (
            <div className="smart-routing-toggle flex items-center justify-between gap-4 rounded-md border border-border bg-well px-4 py-3 shadow-well">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Route by task text</span>
                <span className="font-mono text-xs text-muted-foreground">{smartRouting.enabled ? 'on: score, then check if unclear' : 'off: rules only'}</span>
              </span>
              <Switch
                checked={smartRouting.enabled}
                onCheckedChange={(checked) => field.onChange({ ...smartRouting, enabled: checked })}
                aria-label="Smart routing"
              />
            </div>
          );
        }}
      />
    </SettingsGroup>
  );
}

function RoutingPanel({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <Card className="routing-panel" style={{ '--panel-index': index } as React.CSSProperties}>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

export function RoutingPage() {
  const { form, ready, previousExists, loadError, saveState, save, restore, reload } = useConfigForm();
  const tests = usePoll(loadProviderTests).state;
  const tiers = useWatch({ control: form.control, name: 'tiers' });
  const warnings = tiers === undefined || tests.kind !== 'loaded' ? [] : tierWarnings(tiers, tests.value);

  return (
    <div className="routing-page flex flex-col gap-6">
      {loadError !== null && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {!ready && loadError === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {ready && (
        <>
          <RoutingPanel index={0}>
            <div className="flex flex-col gap-8">
              <TierLadder />
              <TierEditor form={form} />
            </div>
          </RoutingPanel>
          <RoutingPanel index={1}>
            <SmartRoutingSwitch form={form} />
          </RoutingPanel>
          <RoutingPanel index={2}>
            <RoutePreview form={form} />
          </RoutingPanel>
          <AdvancedSection summary="Rules, the effort map and Claude agents">
            <div className="flex flex-col gap-10">
              <RuleEditor form={form} />
              <EffortMapEditor form={form} />
              <ClaudeAgentsEditor form={form} />
            </div>
          </AdvancedSection>
          <SaveBar
            saveState={saveState}
            dirty={form.formState.isDirty}
            previousExists={previousExists}
            warnings={warnings}
            onSave={() => void save()}
            onRestore={() => void restore()}
            onReload={reload}
          />
        </>
      )}
      <style>{`
        @keyframes routing-panel-enter {
          from { opacity: 0.001; transform: translateY(8px); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .routing-panel {
            animation: routing-panel-enter var(--dur-panel) var(--ease-out-expo) both;
            animation-delay: calc(var(--stagger-card) * var(--panel-index, 0));
          }
        }
      `}</style>
    </div>
  );
}
