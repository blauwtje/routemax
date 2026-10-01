import { join } from 'node:path';

export const liveConfigPath = (homeDir: string) => join(homeDir, '.config', 'routemax', 'config.json');
export const backupsDir = (homeDir: string) => join(homeDir, '.local', 'state', 'routemax', 'backups');
export const v1BackupPath = (homeDir: string) => join(backupsDir(homeDir), 'routing.v1.json');
export const previousConfigPath = (homeDir: string) => join(backupsDir(homeDir), 'config.prev.json');
export const providerTestsPath = (homeDir: string) => join(homeDir, '.local', 'state', 'routemax', 'provider-tests.json');
export const claudeUsagePath = (homeDir: string) => join(homeDir, '.local', 'state', 'routemax', 'claude-usage.json');
export const keysEnvPath = (homeDir: string) => join(homeDir, '.config', 'routemax', 'keys.env');
