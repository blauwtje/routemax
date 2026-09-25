import { readFile } from 'node:fs/promises';

interface TelemetryLine {
  ts?: string;
  retries?: unknown[];
}

function parseLine(line: string): TelemetryLine | null {
  try {
    return JSON.parse(line) as TelemetryLine;
  } catch {
    // The proxy appends while we read, so the last line can be partial.
    return null;
  }
}

export async function countProxyRetries(telemetryPath: string, from: Date, to: Date): Promise<number> {
  let text: string;
  try {
    text = await readFile(telemetryPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
  let retries = 0;
  for (const line of text.split('\n')) {
    const entry = line.trim() ? parseLine(line) : null;
    const at = Date.parse(entry?.ts ?? '');
    if (entry && Array.isArray(entry.retries) && at >= from.getTime() && at <= to.getTime()) retries += entry.retries.length;
  }
  return retries;
}
