import { homedir } from 'node:os';
import type { DelegateConfig } from '../config/config-schema';
import { ensureProxy } from '../proxy/ensure-proxy';
import { serverRegistration } from '../setup/register-server';
import { readLaneKey } from '../worker/read-lane-key';
import { commandOnPath } from './command-on-path';
import type { DoctorDeps } from './doctor-checks';

export function doctorDeps(repoRoot: string, config: DelegateConfig, homeDir = homedir()): DoctorDeps {
  return { homeDir, repoRoot, config, registration: serverRegistration(repoRoot, config.claudeBin), readLaneKey, ensureProxy, commandOnPath };
}
