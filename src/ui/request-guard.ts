import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

export const TOKEN_HEADER = 'x-routemax-token';

export interface GuardedRequest {
  url: string;
  method: string;
  headers: IncomingHttpHeaders;
}

function tokenMatches(sent: string | string[] | undefined, token: string): boolean {
  if (typeof sent !== 'string') return false;
  const sentBytes = Buffer.from(sent);
  const tokenBytes = Buffer.from(token);
  return sentBytes.length === tokenBytes.length && timingSafeEqual(sentBytes, tokenBytes);
}

function isJson(contentType: string | undefined): boolean {
  return (contentType ?? '').split(';')[0].trim().toLowerCase() === 'application/json';
}

export function isAllowedRequest(request: GuardedRequest, port: number, token: string): boolean {
  const host = request.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
  const isRead = request.method === 'GET' || request.method === 'HEAD';
  if (!request.url.startsWith('/api/')) return isRead;
  if (!tokenMatches(request.headers[TOKEN_HEADER], token)) return false;
  if (isRead) return true;
  return request.headers.origin === `http://${host}` && isJson(request.headers['content-type']);
}
