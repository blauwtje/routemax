import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A dependency bump in the root package-lock.json does not count as a change; run `npm run build:web` by hand after one.
const WEB_INPUTS = ['src', 'index.html', 'vite.config.ts', 'package.json', 'tsconfig.json'];

function newestModified(path: string): number {
  const stats = statSync(path);
  if (!stats.isDirectory()) return stats.mtimeMs;
  let newest = stats.mtimeMs;
  for (const name of readdirSync(path, { recursive: true, encoding: 'utf8' })) {
    newest = Math.max(newest, statSync(join(path, name)).mtimeMs);
  }
  return newest;
}

export function isWebBuildStale(webDir: string, distDir: string): boolean {
  const builtIndex = join(distDir, 'index.html');
  if (!existsSync(builtIndex)) return true;
  const builtAt = statSync(builtIndex).mtimeMs;
  return WEB_INPUTS.some((input) => {
    const inputPath = join(webDir, input);
    return existsSync(inputPath) && newestModified(inputPath) > builtAt;
  });
}
