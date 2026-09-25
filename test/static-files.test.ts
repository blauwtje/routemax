import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentTypeOf, resolveStaticPath } from '../src/ui/static-files';

const ROOT = '/srv/routemax/web/dist';

describe('resolveStaticPath', () => {
  it('maps an asset under the root and drops the query', () => {
    expect(resolveStaticPath(ROOT, '/assets/index-abc.js?v=1')).toBe(join(ROOT, 'assets', 'index-abc.js'));
  });

  it('falls back to index.html for the root and for a page path without an extension', () => {
    expect(resolveStaticPath(ROOT, '/')).toBe(join(ROOT, 'index.html'));
    expect(resolveStaticPath(ROOT, '/history')).toBe(join(ROOT, 'index.html'));
  });

  it('refuses a path that leaves the root, plain or percent-encoded', () => {
    expect(resolveStaticPath(ROOT, '/../package.json')).toBeNull();
    expect(resolveStaticPath(ROOT, '/assets/%2e%2e/%2e%2e/%2e%2e/package.json')).toBeNull();
    expect(resolveStaticPath(ROOT, '/%2e%2e%2fsecret.txt')).toBeNull();
    expect(resolveStaticPath(ROOT, '/bad%escape.js')).toBeNull();
  });

  it('names the content type by extension', () => {
    expect(contentTypeOf('/x/index.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeOf('/x/a.js')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeOf('/x/a.bin')).toBe('application/octet-stream');
  });
});
