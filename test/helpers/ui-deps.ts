import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG_PATH } from '../../src/config/delegate-config';
import { migrateConfig } from '../../src/config/migrate-config';
import type { UiDeps } from '../../src/ui/api-routes';

export function testUiDeps(homeDir: string): UiDeps {
  const configPath = join(homeDir, 'config.json');
  if (!existsSync(configPath)) {
    const seed = migrateConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8')));
    writeFileSync(configPath, `${JSON.stringify(seed, null, 2)}\n`);
  }
  return {
    homeDir,
    configPath,
    chezmoiBin: join(homeDir, 'no-chezmoi'),
    doctorDeps: () => {
      throw new Error('This test gives no doctor deps; pass doctorDeps to apiRoutes.');
    },
    delegateDeps: () => {
      throw new Error('This test gives no delegate deps; pass delegateDeps to apiRoutes.');
    },
  };
}
