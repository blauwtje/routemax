import { execFile } from 'node:child_process';
import { constants, existsSync } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface AgentInstall {
  repoAgentsDir: string;
  homeDir: string;
  chezmoiBin: string;
}

export interface AgentInstallReport {
  installed: string[];
  messages: string[];
}

async function chezmoiClaudeSource(install: AgentInstall): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(install.chezmoiBin, ['source-path', join(install.homeDir, '.claude')]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function agentBlocker(name: string, sourceEntries: string[], homeDir: string): string | null {
  const variant = sourceEntries.find((entry) => entry !== name && (entry.endsWith(`_${name}`) || entry.endsWith(`${name}.tmpl`)));
  if (variant) return `${variant} in the chezmoi source is not a plain file for ${name}.`;
  if (existsSync(join(homeDir, '.claude', 'agents', name))) return `~/.claude/agents/${name} exists outside chezmoi.`;
  return null;
}

export async function installAgents(install: AgentInstall): Promise<AgentInstallReport> {
  const agentFiles = (await readdir(install.repoAgentsDir)).filter((name) => name.endsWith('.md')).sort();
  const repoPaths = (names: string[]) => names.map((name) => join(install.repoAgentsDir, name)).join(', ');
  const claudeSource = await chezmoiClaudeSource(install);
  if (!claudeSource) {
    return {
      installed: [],
      messages: [`chezmoi is missing or does not manage ~/.claude; nothing was changed. Add ${repoPaths(agentFiles)} to your chezmoi source under dot_claude/agents/.`],
    };
  }
  const agentsSource = join(claudeSource, 'agents');
  const sourceEntries = existsSync(agentsSource) ? await readdir(agentsSource) : [];
  const missing = agentFiles.filter((name) => !sourceEntries.includes(name));
  const blockers = missing.map((name) => agentBlocker(name, sourceEntries, install.homeDir)).filter((blocker) => blocker !== null);
  if (blockers.length) {
    return { installed: [], messages: [...blockers, `Nothing was changed. Add ${repoPaths(missing)} to ${agentsSource} by hand.`] };
  }
  if (!missing.length) return { installed: [], messages: ['The Claude agent files are already in the chezmoi source.'] };
  await mkdir(agentsSource, { recursive: true });
  for (const name of missing) {
    await copyFile(join(install.repoAgentsDir, name), join(agentsSource, name), constants.COPYFILE_EXCL);
  }
  await execFileAsync(install.chezmoiBin, ['apply', ...missing.map((name) => join(install.homeDir, '.claude', 'agents', name))]);
  return { installed: missing, messages: [`Added ${missing.join(', ')} to ${agentsSource} and applied them with chezmoi.`] };
}
