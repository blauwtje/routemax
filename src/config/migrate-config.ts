import { EFFORT_ORDER, formatIssues, v1ConfigSchema, type Effort } from './config-schema';

const DEEPSEEK_PROXY_PORT = 8787;

const hasVersion = (raw: unknown) => typeof raw === 'object' && raw !== null && 'version' in raw;
const deepseekTier = (tier: { model: string; effort: Effort }) => ({ provider: 'deepseek', model: tier.model, effort: tier.effort });

export function migrateConfig(raw: unknown): unknown {
  if (hasVersion(raw)) return raw;
  const parsed = v1ConfigSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`The version 1 config is invalid: ${formatIssues(parsed.error).join('; ')}`);
  const { tiers, prices, proxy, ...shared } = parsed.data;
  return {
    version: 2,
    ...shared,
    providers: {
      deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/anthropic',
        keychainService: 'deepseek_api_key',
        keyVariable: 'DEEPSEEK_API_KEY',
        models: prices,
        efforts: [...EFFORT_ORDER],
        enabled: true,
        repairProxy: { port: DEEPSEEK_PROXY_PORT, logPath: proxy.logPath, telemetryPath: proxy.telemetryPath },
      },
      openrouter: {
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api',
        keychainService: 'openrouter_api_key',
        keyVariable: 'OPENROUTER_API_KEY',
        models: {},
        efforts: [...EFFORT_ORDER],
        enabled: false,
        repairProxy: null,
      },
    },
    tiers: {
      'flash-low': deepseekTier(tiers['flash-low']),
      'flash-high': deepseekTier(tiers['flash-high']),
      'pro-high': deepseekTier(tiers['pro-high']),
    },
    proxy: { dir: proxy.dir },
  };
}
