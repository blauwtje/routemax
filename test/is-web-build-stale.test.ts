import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isWebBuildStale } from '../src/ui/is-web-build-stale';

const BUILT_AT = new Date('2026-01-01T12:00:00Z');
const BEFORE = new Date('2026-01-01T11:00:00Z');
const AFTER = new Date('2026-01-01T13:00:00Z');

function webFixture(sourceTime: Date): { webDir: string; distDir: string; sourceFile: string } {
  const webDir = mkdtempSync(join(tmpdir(), 'routemax-web-'));
  const distDir = join(webDir, 'dist');
  const sourceDir = join(webDir, 'src', 'features');
  mkdirSync(distDir);
  mkdirSync(sourceDir, { recursive: true });
  const sourceFile = join(sourceDir, 'page.tsx');
  writeFileSync(sourceFile, 'export {};');
  writeFileSync(join(distDir, 'index.html'), '<html></html>');
  for (const path of [sourceFile, sourceDir, join(webDir, 'src')]) utimesSync(path, sourceTime, sourceTime);
  utimesSync(join(distDir, 'index.html'), BUILT_AT, BUILT_AT);
  return { webDir, distDir, sourceFile };
}

describe('isWebBuildStale', () => {
  it('is fresh when every source is older than the build', () => {
    const { webDir, distDir } = webFixture(BEFORE);
    expect(isWebBuildStale(webDir, distDir)).toBe(false);
  });

  it('is stale when a nested source file changed after the build', () => {
    const { webDir, distDir, sourceFile } = webFixture(BEFORE);
    utimesSync(sourceFile, AFTER, AFTER);
    expect(isWebBuildStale(webDir, distDir)).toBe(true);
  });

  it('is stale when the build is missing', () => {
    const { webDir } = webFixture(BEFORE);
    expect(isWebBuildStale(webDir, join(webDir, 'no-dist'))).toBe(true);
  });
});
