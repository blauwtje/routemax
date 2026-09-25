import { describe, expect, it } from 'vitest';
import { ApiError, captureToken, createApiClient, TOKEN_HEADER, type TokenStore } from './api-client';

function memoryStore(initial: Record<string, string> = {}): TokenStore & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
}

interface SentRequest { path: string; init: RequestInit }

function fakeFetch(response: () => Response): { fetch: typeof fetch; sent: SentRequest[] } {
  const sent: SentRequest[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    sent.push({ path: String(input), init: init ?? {} });
    return response();
  }) as typeof fetch;
  return { fetch: fetchImpl, sent };
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('captureToken', () => {
  it('moves a #token= fragment into the store', () => {
    const store = memoryStore();
    expect(captureToken('#token=abc_DEF-123', store)).toBe(true);
    expect(store.items.get('routemax-token')).toBe('abc_DEF-123');
  });

  it('ignores a hash without a token', () => {
    const store = memoryStore();
    expect(captureToken('#history', store)).toBe(false);
    expect(captureToken('', store)).toBe(false);
    expect(store.items.size).toBe(0);
  });
});

describe('createApiClient', () => {
  it('sends the token header on a GET and returns the JSON body', async () => {
    const { fetch, sent } = fakeFetch(json({ enabled: true }));
    const api = createApiClient(memoryStore({ 'routemax-token': 'tok' }), fetch);
    await expect(api.request('GET', '/api/switch')).resolves.toEqual({ enabled: true });
    expect(sent[0].path).toBe('/api/switch');
    expect(new Headers(sent[0].init.headers).get(TOKEN_HEADER)).toBe('tok');
    expect(sent[0].init.body).toBeUndefined();
  });

  it('sends a JSON body and content type on a PUT', async () => {
    const { fetch, sent } = fakeFetch(json({ enabled: false }));
    const api = createApiClient(memoryStore({ 'routemax-token': 'tok' }), fetch);
    await api.request('PUT', '/api/switch', { enabled: false });
    expect(sent[0].init.method).toBe('PUT');
    expect(new Headers(sent[0].init.headers).get('content-type')).toBe('application/json');
    expect(sent[0].init.body).toBe('{"enabled":false}');
  });

  it('turns a 422 into an ApiError with the issues', async () => {
    const { fetch } = fakeFetch(json({ error: 'invalid', issues: ['budget.totalUsd: Too small'] }, 422));
    const api = createApiClient(memoryStore({ 'routemax-token': 'tok' }), fetch);
    const failure = await api.request('PUT', '/api/config', {}).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 422, kind: 'invalid', issues: ['budget.totalUsd: Too small'] });
  });

  it('turns an empty 403 into a forbidden ApiError', async () => {
    const { fetch } = fakeFetch(() => new Response(null, { status: 403 }));
    const api = createApiClient(memoryStore({ 'routemax-token': 'tok' }), fetch);
    await expect(api.request('GET', '/api/config')).rejects.toMatchObject({ status: 403, kind: 'forbidden' });
  });

  it('refuses to call the API without a token', async () => {
    const { fetch, sent } = fakeFetch(json({}));
    const api = createApiClient(memoryStore(), fetch);
    await expect(api.request('GET', '/api/config')).rejects.toMatchObject({ kind: 'no-token' });
    expect(sent).toHaveLength(0);
  });
});
