import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A claude stand-in for `claude mcp get|add`: add records its arguments, get prints the last registration.
export function fakeClaude(root: string, registered: string | null = null) {
  const state = join(root, 'mcp-registration');
  const addLog = join(root, 'mcp-add.log');
  if (registered) writeFileSync(state, registered);
  mkdirSync(join(root, 'bin'), { recursive: true });
  writeFileSync(
    join(root, 'bin', 'claude'),
    [
      '#!/bin/sh',
      'case "$1 $2" in',
      `  "mcp get") test -f "${state}" || { echo 'No MCP server named "deepseek-delegate".'; exit 1; }; cat "${state}" ;;`,
      `  "mcp add") shift 2; echo "$@" >> "${addLog}"; echo "$@" > "${state}" ;;`,
      '  *) exit 1 ;;',
      'esac',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
  return { addLog, bin: join(root, 'bin', 'claude') };
}
