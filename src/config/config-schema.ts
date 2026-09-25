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

export type DelegateConfig = z.infer<typeof v1ConfigSchema>;
export type ModelPrice = z.infer<typeof modelPriceSchema>;
