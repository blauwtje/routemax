import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/delegate-config';
import { runDoctorChecks } from './doctor-checks';
import { doctorDeps } from './doctor-deps';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const checks = await runDoctorChecks(doctorDeps(repoRoot, loadConfig()));

for (const check of checks) console.log(`${check.ok ? 'OK ' : 'FIX'}  ${check.name}: ${check.message}`);
const failed = checks.filter((check) => !check.ok).length;
console.log(failed ? `${failed} to fix.` : 'All good: delegate is ready. Restart Claude Code if it was open during setup.');
process.exitCode = failed ? 1 : 0;
