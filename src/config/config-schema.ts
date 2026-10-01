import { z } from 'zod';

export const TIER_ORDER = ['flash-low', 'flash-high', 'pro-high', 'claude'] as const;
export const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Tier = (typeof TIER_ORDER)[number];
export type WorkerTier = Exclude<Tier, 'claude'>;
export type Effort = (typeof EFFORT_ORDER)[number];

export const effortSchema = z.enum(EFFORT_ORDER);
export const modelPriceSchema = z.object({
  inputUsd: z.number().nonnegative(),
  cacheHitUsd: z.number().nonnegative(),
  outputUsd: z.number().nonnegative(),
});

export const sharedFieldsSchema = z.object({
  rules: z.array(
    z.object({
      id: z.string().min(1),
      taskTypes: z.array(z.string()).default([]),
      keywords: z.array(z.string()).default([]),
      keywordExemptTaskTypes: z.array(z.string()).default([]),
      flags: z.array(z.string()).default([]),
      tier: z.enum(TIER_ORDER),
    }),
  ),
  effortMap: z.record(effortSchema, effortSchema),
  claude: z.object({
    defaultAgent: z.string().min(1),
    agents: z.record(z.string(), z.object({ model: z.string().min(1), effort: effortSchema })),
    taskTypes: z.record(z.string(), z.string()),
  }),
  budget: z.object({ totalUsd: z.number().positive(), perCallUsd: z.number().positive() }),
  workerTimeoutMs: z.number().int().positive(),
  testTimeoutMs: z.number().int().positive(),
  retryThreshold: z.number().int().nonnegative().nullable(),
  projects: z.record(z.string(), z.object({ testCommand: z.string().min(1) })),
  exploreRedirect: z.boolean(),
  claudeBin: z.string().min(1),
});

const v1TierSchema = z.object({ model: z.string().min(1), effort: effortSchema });

export const v1ConfigSchema = sharedFieldsSchema
  .extend({
    tiers: z.object({ 'flash-low': v1TierSchema, 'flash-high': v1TierSchema, 'pro-high': v1TierSchema }),
    prices: z.record(z.string(), modelPriceSchema),
    proxy: z.object({ dir: z.string().min(1), logPath: z.string().min(1), telemetryPath: z.string().min(1) }),
  })
  .superRefine((config, context) => {
    for (const name of [config.claude.defaultAgent, ...Object.values(config.claude.taskTypes)]) {
      if (!config.claude.agents[name]) {
        context.addIssue({ code: 'custom', message: `claude agent ${name} is not defined in claude.agents` });
      }
    }
    for (const tier of Object.values(config.tiers)) {
      if (!config.prices[tier.model]) {
        context.addIssue({ code: 'custom', message: `model ${tier.model} has no entry in prices` });
      }
    }
  });

export type ModelPrice = z.infer<typeof modelPriceSchema>;

const repairProxySchema = z.object({
  port: z.number().int().min(1).max(65_535),
  logPath: z.string().min(1),
  telemetryPath: z.string().min(1),
});

const peakSchema = z.object({
  windowsUtc: z.array(z.tuple([z.number().min(0).max(24), z.number().min(0).max(24)])),
  weekdaysOnly: z.boolean(),
  priceFactor: z.number().positive(),
});

const providerSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.url(),
  keychainService: z.string().min(1).optional(),
  keyVariable: z.string().min(1).optional(),
  peak: peakSchema.optional(),
  models: z.record(z.string().min(1), modelPriceSchema),
  efforts: z.array(effortSchema).min(1),
  enabled: z.boolean(),
  repairProxy: repairProxySchema.nullable(),
});

const workerTierSchema = z.object({ provider: z.string().min(1), model: z.string().min(1), effort: effortSchema });

const lanesSchema = z.object({
  fallback: z.object({ provider: z.string().min(1), model: z.string().min(1) }).nullable(),
  preferGlmAtPeak: z.boolean(),
});

export const smartRoutingSchema = z.object({
  enabled: z.boolean(),
  checkTimeoutMs: z.number().int().positive(),
});

export const configSchema = sharedFieldsSchema
  .extend({
    version: z.literal(2),
    providers: z.record(z.string().regex(/^[a-z0-9-]+$/, 'use lowercase letters, digits and dashes'), providerSchema),
    tiers: z.object({ 'flash-low': workerTierSchema, 'flash-high': workerTierSchema, 'pro-high': workerTierSchema }),
    proxy: z.object({ dir: z.string().min(1) }),
    smartRouting: smartRoutingSchema.default({ enabled: true, checkTimeoutMs: 3000 }),
    lanes: lanesSchema.default({ fallback: null, preferGlmAtPeak: false }),
    taskEfforts: z.record(z.string(), effortSchema).default({}),
  })
  .superRefine((config, context) => {
    const agentReferences: [string[], string][] = [
      [['claude', 'defaultAgent'], config.claude.defaultAgent],
      ...Object.entries(config.claude.taskTypes).map(([taskType, name]): [string[], string] => [['claude', 'taskTypes', taskType], name]),
    ];
    for (const [path, name] of agentReferences) {
      if (!config.claude.agents[name]) {
        context.addIssue({ code: 'custom', path, message: `claude agent ${name} is not defined in claude.agents` });
      }
    }
    for (const [tierName, tier] of Object.entries(config.tiers)) {
      const provider = config.providers[tier.provider];
      if (!provider) {
        context.addIssue({ code: 'custom', path: ['tiers', tierName, 'provider'], message: `provider ${tier.provider} does not exist` });
      } else if (!provider.enabled) {
        context.addIssue({ code: 'custom', path: ['tiers', tierName, 'provider'], message: `provider ${tier.provider} is disabled` });
      } else if (!provider.models[tier.model]) {
        context.addIssue({ code: 'custom', path: ['tiers', tierName, 'model'], message: `model ${tier.model} has no entry in providers.${tier.provider}.models` });
      }
    }
    const fallback = config.lanes.fallback;
    if (fallback) {
      const provider = config.providers[fallback.provider];
      if (!provider) {
        context.addIssue({ code: 'custom', path: ['lanes', 'fallback', 'provider'], message: `provider ${fallback.provider} does not exist` });
      } else if (!provider.models[fallback.model]) {
        context.addIssue({ code: 'custom', path: ['lanes', 'fallback', 'model'], message: `model ${fallback.model} has no entry in providers.${fallback.provider}.models` });
      }
    }
  });

export type Provider = z.infer<typeof providerSchema>;
export type RepairProxy = z.infer<typeof repairProxySchema>;
export type Peak = z.infer<typeof peakSchema>;
export type Lanes = z.infer<typeof lanesSchema>;
export type SmartRouting = z.infer<typeof smartRoutingSchema>;
export type DelegateConfig = z.infer<typeof configSchema>;

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.map(String).join('.') || 'config'}: ${issue.message}`);
}

export function configIssues(input: unknown): string[] {
  const parsed = configSchema.safeParse(input);
  return parsed.success ? [] : formatIssues(parsed.error);
}
