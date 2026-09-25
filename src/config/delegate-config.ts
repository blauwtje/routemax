import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const TIER_ORDER = ['flash-low', 'flash-high', 'pro-high', 'claude'] as const;
export const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Tier = (typeof TIER_ORDER)[number];
export type WorkerTier = Exclude<Tier, 'claude'>;
export type Effort = (typeof EFFORT_ORDER)[number];

export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../config/routing.json', import.meta.url));

const effortSchema = z.enum(EFFORT_ORDER);
const workerTierSchema = z.object({ model: z.string().min(1), effort: effortSchema });
const priceSchema = z.object({
  inputUsd: z.number().nonnegative(),
  cacheHitUsd: z.number().nonnegative(),
  outputUsd: z.number().nonnegative(),
});
const expandHome = (path: string) => (path.startsWith('~/') ? join(homedir(), path.slice(2)) : path);

const configSchema = z
  .object({
    tiers: z.object({ 'flash-low': workerTierSchema, 'flash-high': workerTierSchema, 'pro-high': workerTierSchema }),
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
    prices: z.record(z.string(), priceSchema),
    workerTimeoutMs: z.number().int().positive(),
    testTimeoutMs: z.number().int().positive(),
    retryThreshold: z.number().int().nonnegative().nullable(),
    projects: z.record(z.string(), z.object({ testCommand: z.string().min(1) })),
    exploreRedirect: z.boolean(),
    claudeBin: z.string().min(1),
    proxy: z.object({
      dir: z.string().min(1),
      logPath: z.string().min(1),
      telemetryPath: z.string().min(1).transform(expandHome),
    }),
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

export type DelegateConfig = z.infer<typeof configSchema>;
export type ModelPrice = z.infer<typeof priceSchema>;

export function loadConfig(path = process.env.DEEPSEEK_DELEGATE_CONFIG ?? DEFAULT_CONFIG_PATH): DelegateConfig {
  return configSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}
