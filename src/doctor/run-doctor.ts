import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/delegate-config';
import { ensureProxy } from '../proxy/ensure-proxy';
import { serverRegistration } from '../setup/register-server';
import { readApiKey } from '../worker/read-api-key';
import { runDoctorChecks } from './doctor-checks';
import { commandOnPath } from './command-on-path';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const config = loadConfig();

const checks = await runDoctorChecks({
  homeDir: homedir(),
  repoRoot,
  config,
  registration: serverRegistration(repoRoot, config.claudeBin),
  readApiKey,
  ensureProxy,
  commandOnPath,
});

for (const check of checks) console.log(`${check.ok ? 'OK ' : 'FIX'}  ${check.name}: ${check.message}`);
const failed = checks.filter((check) => !check.ok).length;
console.log(failed ? `${failed} to fix.` : 'All good: delegate is ready. Restart Claude Code if it was open during setup.');
process.exitCode = failed ? 1 : 0;
