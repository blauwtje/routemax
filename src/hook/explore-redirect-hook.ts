import { readFileSync } from 'node:fs';
import { loadConfig } from '../config/delegate-config';
import { exploreRedirect, type HookInput } from './explore-redirect';

const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
const deny = exploreRedirect(input, {
  enabled: loadConfig().exploreRedirect,
  depth: Number(process.env.DEEPSEEK_DELEGATE_DEPTH ?? 0),
});
if (deny) process.stdout.write(`${JSON.stringify(deny)}\n`);
