import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';

let server: UiServer;

beforeAll(async () => {
  const dist = mkdtempSync(join(tmpdir(), 'routemax-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<main>routemax</main>');
  writeFileSync(join(dist, 'assets', 'app.js'), 'console.log(1);');
  server = await startUiServer(dist, [
    { method: 'GET', pattern: /^\/api\/ping$/, handle: async () => ({ status: 200, body: { pong: true } }) },
    { method: 'PUT', pattern: /^\/api\/echo\/([\w-]+)$/, handle: async ({ params, body }) => ({ status: 200, body: { id: params[0], body } }) },
  ]);
});

afterAll(() => server.close());

describe('startUiServer', () => {
  it('listens on 127.0.0.1 only and prints a page URL with the token in the fragment', () => {
    expect(server.address).toBe('127.0.0.1');
    expect(server.url).toBe(`http://127.0.0.1:${server.port}/#token=${server.token}`);
    expect(server.token.length).toBeGreaterThanOrEqual(43);
  });

  it('answers an API call that passes the guard', async () => {
    const reply = await uiCall(server.port, 'GET', '/api/ping', pageHeaders(server.port, server.token));
    expect(reply.status).toBe(200);
    expect(reply.json()).toEqual({ pong: true });
    const echo = await uiCall(server.port, 'PUT', '/api/echo/deepseek', pageHeaders(server.port, server.token, true), { a: 1 });
    expect(echo.json()).toEqual({ id: 'deepseek', body: { a: 1 } });
  });

  it('refuses without the token, with a foreign Host or a foreign Origin: 403 and an empty body', async () => {
    const own = pageHeaders(server.port, server.token, true);
    const replies = await Promise.all([
      uiCall(server.port, 'GET', '/api/ping', { host: `127.0.0.1:${server.port}` }),
      uiCall(server.port, 'GET', '/api/ping', { ...own, host: `evil.test:${server.port}` }),
      uiCall(server.port, 'PUT', '/api/echo/x', { ...own, origin: 'http://evil.test' }, {}),
    ]);
    for (const reply of replies) expect([reply.status, reply.text]).toEqual([403, '']);
  });

  it('answers 404 for an unknown API path and 422 for a body that is not JSON', async () => {
    const unknown = await uiCall(server.port, 'GET', '/api/nothing', pageHeaders(server.port, server.token));
    expect(unknown.status).toBe(404);
    const broken = await uiCall(server.port, 'PUT', '/api/echo/x', pageHeaders(server.port, server.token, true));
    expect(broken.status).toBe(422);
    expect(broken.json()).toEqual({ error: 'invalid', issues: ['The request body is not JSON.'] });
  });

  it('serves the page, an asset and the page again for an app path, and 404 for a missing asset', async () => {
    const host = { host: `localhost:${server.port}` };
    expect((await uiCall(server.port, 'GET', '/', host)).text).toBe('<main>routemax</main>');
    expect((await uiCall(server.port, 'GET', '/history', host)).text).toBe('<main>routemax</main>');
    expect((await uiCall(server.port, 'GET', '/assets/app.js', host)).text).toBe('console.log(1);');
    expect((await uiCall(server.port, 'GET', '/assets/missing.js', host)).status).toBe(404);
  });
});
