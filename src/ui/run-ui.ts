import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeConfigPath, loadConfig } from '../config/delegate-config';
import { doctorDeps } from '../doctor/doctor-deps';
import { ensureProxy } from '../proxy/ensure-proxy';
import { readApiKey } from '../worker/read-api-key';
import { apiRoutes, type UiDeps } from './api-routes';
import { startUiServer } from './ui-server';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function liveUiDeps(homeDir: string, configPath: string): UiDeps {
  return {
    homeDir,
    configPath,
    chezmoiBin: 'chezmoi',
    doctorDeps: () => doctorDeps(REPO_ROOT, loadConfig(configPath), homeDir),
    delegateDeps: () => ({ config: loadConfig(configPath), homeDir, cwd: process.cwd(), env: process.env, readApiKey, ensureProxy }),
  };
}

export async function runUi(): Promise<void> {
  const distDir = process.env.ROUTEMAX_UI_DIST ?? join(REPO_ROOT, 'web', 'dist');
  if (!existsSync(join(distDir, 'index.html'))) {
    console.error(`The routemax page is not built: ${join(distDir, 'index.html')} is missing. Run \`npm run setup\` in ${REPO_ROOT}.`);
    process.exitCode = 1;
    return;
  }
  const homeDir = homedir();
  const server = await startUiServer(distDir, apiRoutes(liveUiDeps(homeDir, activeConfigPath())));
  console.log(`routemax ui: ${server.url}`);
  console.log('Press Ctrl-C to stop.');
  if (!process.env.ROUTEMAX_NO_OPEN) spawn('open', [server.url], { stdio: 'ignore', detached: true }).unref();
  process.once('SIGINT', () => {
    void server.close().then(() => process.exit(0));
  });
}
