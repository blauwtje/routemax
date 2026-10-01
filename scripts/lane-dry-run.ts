import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeConfigPath, loadConfig } from '../src/config/delegate-config';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { delegate } from '../src/delegate/delegate';
import { ensureProxy } from '../src/proxy/ensure-proxy';
import { readLaneKey } from '../src/worker/read-lane-key';

const flagIndex = process.argv.indexOf('--lane');
const lane = flagIndex === -1 ? undefined : process.argv[flagIndex + 1];
if (!lane) {
  console.error('Usage: npx tsx scripts/lane-dry-run.ts --lane <provider id, e.g. deepseek or zai-glm>');
  process.exit(2);
}

const config = loadConfig(activeConfigPath());
if (!config.providers[lane]) {
  console.error(`Lane ${lane} is not a provider in the config: ${Object.keys(config.providers).join(', ')}`);
  process.exit(2);
}

// The lane's model is the one a tier or the fallback lane already names for that provider.
const candidates = [...Object.values(config.tiers), config.lanes.fallback].filter((entry) => entry?.provider === lane);
const model = candidates[0]?.model;
if (!model) {
  console.error(`No tier or fallback lane names a model for ${lane}.`);
  process.exit(2);
}

// Every worker tier points at the forced lane and the fallback is off, so the log line shows that lane alone.
const effort = config.tiers['flash-low'].effort;
const forcedTier = { provider: lane, model, effort };
const forced = {
  ...config,
  tiers: { 'flash-low': forcedTier, 'flash-high': forcedTier, 'pro-high': forcedTier },
  lanes: { ...config.lanes, fallback: null, preferGlmAtPeak: false },
  smartRouting: { ...config.smartRouting, enabled: false },
};

// A scratch home keeps the live on/off switch and decision log out of the run; the worker setup and keys are linked in.
const realHome = homedir();
const home = mkdtempSync(join(tmpdir(), 'routemax-lane-home-'));
mkdirSync(join(home, '.config'));
symlinkSync(join(realHome, '.config', 'routemax'), join(home, '.config', 'routemax'));
symlinkSync(join(realHome, '.claude-deepseek'), join(home, '.claude-deepseek'));
const cwd = mkdtempSync(join(tmpdir(), 'routemax-lane-'));
const result = await delegate(
  { task: 'Reply with the single word ok. Do not read or change any file.', taskType: 'read', requestedTier: 'flash-low', flags: [] },
  { config: forced, homeDir: home, cwd, env: process.env, readLaneKey, ensureProxy, fetchImpl: fetch },
);
console.log(`result: ${result.status}`);
const lines = readFileSync(decisionLogPath(home), 'utf8').trimEnd().split('\n');
console.log(lines[lines.length - 1]);
console.log(`(log: ${decisionLogPath(home)})`);
