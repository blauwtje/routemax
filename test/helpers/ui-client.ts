import { request } from 'node:http';
import { TOKEN_HEADER } from '../../src/ui/request-guard';

export interface UiReply {
  status: number;
  text: string;
  json: () => unknown;
}

export function uiCall(port: number, method: string, path: string, headers: Record<string, string>, body?: unknown): Promise<UiReply> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const outgoing = request({ host: '127.0.0.1', port, method, path, headers }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
      incoming.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: incoming.statusCode ?? 0, text, json: () => JSON.parse(text) });
      });
    });
    outgoing.on('error', reject);
    outgoing.end(payload);
  });
}

export function pageHeaders(port: number, token: string, write = false): Record<string, string> {
  const headers: Record<string, string> = { host: `127.0.0.1:${port}`, [TOKEN_HEADER]: token };
  if (write) Object.assign(headers, { origin: `http://127.0.0.1:${port}`, 'content-type': 'application/json' });
  return headers;
}
