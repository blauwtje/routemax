import { extname, resolve, sep } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function contentTypeOf(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function resolveStaticPath(root: string, url: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.split('?')[0]);
  } catch {
    return null;
  }
  const rootDir = resolve(root);
  const candidate = resolve(rootDir, `.${pathname}`);
  if (candidate !== rootDir && !candidate.startsWith(`${rootDir}${sep}`)) return null;
  if (candidate === rootDir || extname(candidate) === '') return resolve(rootDir, 'index.html');
  return candidate;
}
