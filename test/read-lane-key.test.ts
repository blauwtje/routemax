import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { keysEnvPath } from '../src/config/routemax-paths';
import { MissingLaneKeyError, readLaneKey } from '../src/worker/read-lane-key';

const homeWithKeys = (text?: string) => {
  const homeDir = mkdtempSync(`${tmpdir()}/routemax-lane-key-`);
  if (text === undefined) return homeDir;
  mkdirSync(dirname(keysEnvPath(homeDir)), { recursive: true });
  writeFileSync(keysEnvPath(homeDir), text);
  return homeDir;
};

describe('readLaneKey', () => {
  it('returns the key of the named variable', () => {
    const homeDir = homeWithKeys('# keys\nOTHER=nope\nDEEPSEEK_API_KEY=sk-fake-deepseek\n');
    expect(readLaneKey(homeDir, 'DEEPSEEK_API_KEY')).toBe('sk-fake-deepseek');
  });

  it('throws a missing-key error when keys.env does not exist', () => {
    expect(() => readLaneKey(homeWithKeys(), 'DEEPSEEK_API_KEY')).toThrow(MissingLaneKeyError);
  });

  it('throws a missing-key error when keys.env is unreadable', () => {
    const homeDir = homeWithKeys();
    mkdirSync(keysEnvPath(homeDir), { recursive: true });
    expect(() => readLaneKey(homeDir, 'DEEPSEEK_API_KEY')).toThrow(MissingLaneKeyError);
  });

  it('throws a missing-key error when the variable is absent', () => {
    expect(() => readLaneKey(homeWithKeys('OTHER=x\n'), 'DEEPSEEK_API_KEY')).toThrow(MissingLaneKeyError);
  });

  it('throws a missing-key error when the value is empty', () => {
    expect(() => readLaneKey(homeWithKeys('DEEPSEEK_API_KEY=\n'), 'DEEPSEEK_API_KEY')).toThrow(MissingLaneKeyError);
  });
});
