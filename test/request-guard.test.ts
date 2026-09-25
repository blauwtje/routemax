import { describe, expect, it } from 'vitest';
import { isAllowedRequest, TOKEN_HEADER } from '../src/ui/request-guard';

const PORT = 4321;
const TOKEN = 'secret-token';

function request(url: string, method: string, headers: Record<string, string>) {
  return { url, method, headers };
}

const apiGet = { host: `127.0.0.1:${PORT}`, [TOKEN_HEADER]: TOKEN };
const apiPut = { ...apiGet, origin: `http://127.0.0.1:${PORT}`, 'content-type': 'application/json; charset=utf-8' };

describe('isAllowedRequest', () => {
  it('lets through an API read with the token and the own Host, on 127.0.0.1 and localhost', () => {
    expect(isAllowedRequest(request('/api/config', 'GET', apiGet), PORT, TOKEN)).toBe(true);
    expect(isAllowedRequest(request('/api/config', 'GET', { ...apiGet, host: `localhost:${PORT}` }), PORT, TOKEN)).toBe(true);
  });

  it('refuses an API request without the token or with a wrong one', () => {
    expect(isAllowedRequest(request('/api/config', 'GET', { host: `127.0.0.1:${PORT}` }), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/api/config', 'GET', { ...apiGet, [TOKEN_HEADER]: 'secret-tokeX' }), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/api/config', 'GET', { ...apiGet, [TOKEN_HEADER]: 'short' }), PORT, TOKEN)).toBe(false);
  });

  it('refuses a foreign Host, including the own host on another port', () => {
    expect(isAllowedRequest(request('/api/config', 'GET', { ...apiGet, host: `evil.test:${PORT}` }), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/api/config', 'GET', { ...apiGet, host: '127.0.0.1:9999' }), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/', 'GET', { host: `evil.test:${PORT}` }), PORT, TOKEN)).toBe(false);
  });

  it('refuses a write without the own Origin or without a JSON content type', () => {
    expect(isAllowedRequest(request('/api/config', 'PUT', apiPut), PORT, TOKEN)).toBe(true);
    expect(isAllowedRequest(request('/api/config', 'PUT', { ...apiPut, origin: 'http://evil.test' }), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/api/config', 'PUT', { ...apiPut, origin: `http://localhost:${PORT}` }), PORT, TOKEN)).toBe(false);
    const { origin: _origin, ...withoutOrigin } = apiPut;
    expect(isAllowedRequest(request('/api/config', 'PUT', withoutOrigin), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/api/config', 'PUT', { ...apiPut, 'content-type': 'text/plain' }), PORT, TOKEN)).toBe(false);
  });

  it('serves the static page with the own Host and no token', () => {
    expect(isAllowedRequest(request('/', 'GET', { host: `127.0.0.1:${PORT}` }), PORT, TOKEN)).toBe(true);
    expect(isAllowedRequest(request('/assets/index.js', 'GET', { host: `localhost:${PORT}` }), PORT, TOKEN)).toBe(true);
    expect(isAllowedRequest(request('/', 'POST', { host: `127.0.0.1:${PORT}` }), PORT, TOKEN)).toBe(false);
  });
});
