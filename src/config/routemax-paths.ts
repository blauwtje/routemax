import { join } from 'node:path';

export const liveConfigPath = (homeDir: string) => join(homeDir, '.config', 'routemax', 'config.json');
export const backupsDir = (homeDir: string) => join(homeDir, '.local', 'state', 'routemax', 'backups');
export const v1BackupPath = (homeDir: string) => join(backupsDir(homeDir), 'routing.v1.json');
