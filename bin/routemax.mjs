#!/usr/bin/env node
import { tsImport } from 'tsx/esm/api';

const [command] = process.argv.slice(2);
if (command !== 'ui') {
  console.error('Usage: routemax ui');
  process.exit(2);
}
const { runUi } = await tsImport('../src/ui/run-ui.ts', import.meta.url);
await runUi();
