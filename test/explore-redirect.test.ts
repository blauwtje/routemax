import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH } from '../src/config/delegate-config';
import { EXPLORE_REDIRECT_REASON, exploreRedirect } from '../src/hook/explore-redirect';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const explore = { tool_name: 'Agent', tool_input: { subagent_type: 'Explore' } };
const deny = {
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: EXPLORE_REDIRECT_REASON },
};

function runHook(input: unknown, exploreRedirectOn: boolean, depth = '0'): string {
  const configPath = join(mkdtempSync(join(tmpdir(), 'routemax-hook-')), 'routing.json');
  writeFileSync(configPath, JSON.stringify({ ...JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8')), exploreRedirect: exploreRedirectOn }));
  return execFileSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'src/hook/explore-redirect-hook.ts')], {
    input: JSON.stringify(input),
    env: { ...process.env, DEEPSEEK_DELEGATE_CONFIG: configPath, DEEPSEEK_DELEGATE_DEPTH: depth },
    encoding: 'utf8',
  });
}

describe('exploreRedirect', () => {
  it('denies Explore with a pointer to delegate when on', () => {
    expect(exploreRedirect(explore, { enabled: true, depth: 0 })).toEqual(deny);
    expect(EXPLORE_REDIRECT_REASON).toContain('taskType "search"');
  });

  it('does nothing when off', () => {
    expect(exploreRedirect(explore, { enabled: false, depth: 0 })).toBeNull();
  });

  it('touches only Explore, never exo agents or other types', () => {
    for (const subagent_type of ['general-purpose', 'exo:explorer', 'exo:implementer']) {
      expect(exploreRedirect({ tool_name: 'Agent', tool_input: { subagent_type } }, { enabled: true, depth: 0 })).toBeNull();
    }
    expect(exploreRedirect({ tool_name: 'Read', tool_input: {} }, { enabled: true, depth: 0 })).toBeNull();
  });

  it('does nothing at depth 1 or more', () => {
    expect(exploreRedirect(explore, { enabled: true, depth: 1 })).toBeNull();
  });
});

describe('explore-redirect-hook entry', () => {
  it('prints nothing with the shipped config, where the switch is off', () => {
    expect(runHook(explore, false)).toBe('');
  });

  it('prints the deny JSON when the switch is on', () => {
    expect(JSON.parse(runHook(explore, true))).toEqual(deny);
  });

  it('prints nothing inside a worker', () => {
    expect(runHook(explore, true, '1')).toBe('');
  });
});
