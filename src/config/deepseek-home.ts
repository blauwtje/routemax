import { join } from 'node:path';

export const deepseekHomeDir = (homeDir: string) => join(homeDir, '.claude-deepseek');
export const envVarsPath = (homeDir: string) => join(deepseekHomeDir(homeDir), 'env.vars');
export const mcpConfigPath = (homeDir: string) => join(deepseekHomeDir(homeDir), 'mcp.json');
export const settingsPath = (homeDir: string) => join(deepseekHomeDir(homeDir), 'settings.json');
