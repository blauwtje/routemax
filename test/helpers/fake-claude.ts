import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface McpGetEntry {
  scope: 'user' | 'local';
  connected: boolean;
  command: string;
  args: string[];
}

const SCOPE_LABELS = { user: 'User config (available in all your projects)', local: 'Local config (private to you in this project)' };

// The `claude mcp get deepseek-delegate` output of Claude Code 2.1.282.
export function mcpGetOutput(entry: McpGetEntry): string {
  return [
    'deepseek-delegate:',
    `  Scope: ${SCOPE_LABELS[entry.scope]}`,
    `  Status: ${entry.connected ? '✔ Connected' : '✘ Failed to connect'}`,
    '  Type: stdio',
    `  Command: ${entry.command}`,
    `  Args: ${entry.args.join(' ')}`,
    '  Environment:',
    '',
    `To remove this server, run: claude mcp remove deepseek-delegate -s ${entry.scope}`,
    '',
  ].join('\n');
}

// A claude stand-in for `claude mcp get|add`: add records its arguments and registers a connected user-scope
// server unless `connects` is false; get prints the registration.
export function fakeClaude(root: string, registered: McpGetEntry | null = null, connects = true) {
  const state = join(root, 'mcp-registration');
  const addLog = join(root, 'mcp-add.log');
  if (registered) writeFileSync(state, mcpGetOutput(registered));
  const status = connects ? '✔ Connected' : '✘ Failed to connect';
  mkdirSync(join(root, 'bin'), { recursive: true });
  writeFileSync(
    join(root, 'bin', 'claude'),
    [
      '#!/bin/sh',
      'case "$1 $2" in',
      `  "mcp get") test -f "${state}" || { echo 'No MCP server named "deepseek-delegate".'; exit 1; }; cat "${state}" ;;`,
      `  "mcp add") shift 2; echo "$@" >> "${addLog}"; shift 4; command="$1"; shift;`,
      `    printf 'deepseek-delegate:\\n  Scope: ${SCOPE_LABELS.user}\\n  Status: ${status}\\n  Command: %s\\n  Args: %s\\n\\nTo remove this server, run: claude mcp remove deepseek-delegate -s user\\n' "$command" "$*" > "${state}" ;;`,
      '  *) exit 1 ;;',
      'esac',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
  return { addLog, bin: join(root, 'bin', 'claude') };
}
