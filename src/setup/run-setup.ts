import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/delegate-config';
import { addDeepseekHomeToChezmoi } from './add-deepseek-home-to-chezmoi';
import { createDeepseekHome } from './create-deepseek-home';
import { findAnthropicVariables } from './find-anthropic-variables';
import { installAgents } from './install-agents';
import { registerServer, serverRegistration } from './register-server';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const homeDir = homedir();

for (const path of await createDeepseekHome(homeDir)) console.log(`Created ${path}`);

const deepseekHome = await addDeepseekHomeToChezmoi({ homeDir, chezmoiBin: 'chezmoi' });
for (const message of deepseekHome.messages) console.log(message);

const agents = await installAgents({ repoAgentsDir: join(repoRoot, 'agents'), homeDir, chezmoiBin: 'chezmoi' });
for (const message of agents.messages) console.log(message);

const registration = await registerServer(serverRegistration(repoRoot, loadConfig().claudeBin));
if (registration.ok) {
  console.log(registration.message);
} else {
  console.error(registration.message);
  process.exitCode = 1;
}

const leaked = await findAnthropicVariables(join(homeDir, '.claude', 'settings.json'));
if (leaked.length) {
  console.error(`~/.claude/settings.json holds ${leaked.join(', ')}. Remove them from its chezmoi source so the Max session keeps its own model and login.`);
  process.exitCode = 1;
}
