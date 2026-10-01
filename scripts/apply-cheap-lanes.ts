import { homedir } from 'node:os';
import { readStoredConfig, saveConfig } from '../src/config/config-store';
import { liveConfigPath, previousConfigPath } from '../src/config/routemax-paths';

const TASK_TYPES = ['search', 'read', 'summarize', 'boilerplate', 'tests', 'simple-edit', 'build'];
const DEEPSEEK_PEAK = { windowsUtc: [[1, 4], [6, 10]], weekdaysOnly: true, priceFactor: 2 };
const ZAI_FREE = { inputUsd: 0, cacheHitUsd: 0, outputUsd: 0 };

const zaiProvider = {
  name: 'Z.ai GLM',
  baseUrl: 'https://api.z.ai/api/anthropic',
  keyVariable: 'ZAI_API_KEY',
  models: { 'GLM-5.3': ZAI_FREE, 'GLM-5.3-Flash': ZAI_FREE },
  efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  enabled: true,
  repairProxy: null,
};

const configPath = liveConfigPath(homedir());
const previousPath = previousConfigPath(homedir());
const stored = readStoredConfig(configPath, previousPath);
const config = stored.config as any;

config.tiers['flash-low'].effort = 'high';
for (const rule of config.rules) {
  if (rule.taskTypes.includes('build')) rule.tier = 'flash-high';
}
Object.assign(config.providers.deepseek.models['deepseek-flash'], { inputUsd: 0.15, cacheHitUsd: 0.006, outputUsd: 0.6 });
config.providers.deepseek.keyVariable = 'DEEPSEEK_API_KEY';
config.providers.deepseek.peak = DEEPSEEK_PEAK;
config.providers['zai-glm'] = zaiProvider;
config.lanes = { fallback: { provider: 'zai-glm', model: 'GLM-5.3' }, preferGlmAtPeak: config.lanes?.preferGlmAtPeak ?? false };
config.taskEfforts = Object.fromEntries(TASK_TYPES.map((taskType) => [taskType, 'high']));

const outcome = saveConfig(configPath, previousPath, config, stored.hash);
if (!outcome.ok) {
  console.error(`${outcome.kind}: ${outcome.issues.join('; ')}`);
  process.exit(1);
}
console.log(`Wrote ${configPath}; previous version kept at ${previousPath}`);
