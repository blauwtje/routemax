import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isAllowedRequest } from './request-guard';
import { contentTypeOf, resolveStaticPath } from './static-files';

export interface ApiRequest {
  params: string[];
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface ApiRoute {
  method: string;
  pattern: RegExp;
  handle: (request: ApiRequest) => Promise<ApiResponse>;
}

export interface UiServer {
  address: string;
  port: number;
  token: string;
  url: string;
  close: () => Promise<void>;
}

const MAX_BODY_BYTES = 1_000_000;
const NOT_JSON: ApiResponse = { status: 422, body: { error: 'invalid', issues: ['The request body is not JSON.'] } };

function send(response: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    response.writeHead(status, { 'content-length': '0' }).end();
    return;
  }
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function answerApi(request: IncomingMessage, pathname: string, routes: ApiRoute[]): Promise<ApiResponse> {
  for (const route of routes) {
    const match = route.method === request.method ? route.pattern.exec(pathname) : null;
    if (!match) continue;
    let body: unknown = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        body = JSON.parse(await readBody(request));
      } catch {
        return NOT_JSON;
      }
    }
    return route.handle({ params: match.slice(1), body });
  }
  return { status: 404, body: { error: 'missing', issues: [`No API route ${request.method} ${pathname}.`] } };
}

async function serveStatic(distDir: string, url: string, response: ServerResponse): Promise<void> {
  const filePath = resolveStaticPath(distDir, url);
  if (!filePath) return send(response, 404);
  try {
    const content = await readFile(filePath);
    response.writeHead(200, { 'content-type': contentTypeOf(filePath) }).end(content);
  } catch {
    send(response, 404);
  }
}

export async function startUiServer(distDir: string, routes: ApiRoute[], token = randomBytes(32).toString('base64url')): Promise<UiServer> {
  let port = 0;
  const server = createServer((request, response) => {
    const url = request.url ?? '/';
    if (!isAllowedRequest({ url, method: request.method ?? 'GET', headers: request.headers }, port, token)) return send(response, 403);
    if (!url.startsWith('/api/')) return void serveStatic(distDir, url, response);
    const pathname = url.split('?')[0];
    answerApi(request, pathname, routes).then(
      (reply) => send(response, reply.status, reply.body),
      (error: unknown) => {
        console.error(`routemax ui: ${request.method} ${pathname} failed (${(error as Error).name})`);
        send(response, 500, { error: 'failed', issues: ['The server could not finish the request. See the terminal running routemax ui.'] });
      },
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  port = address.port;
  return {
    address: address.address,
    port,
    token,
    url: `http://127.0.0.1:${port}/#token=${token}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
