export const TOKEN_HEADER = 'x-routemax-token';
const TOKEN_KEY = 'routemax-token';
const TOKEN_FRAGMENT = /^#token=([A-Za-z0-9_-]+)$/;

export interface TokenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ApiMethod = 'GET' | 'PUT' | 'POST';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly kind: string,
    readonly issues: string[],
  ) {
    super(issues.length > 0 ? issues.join('\n') : `The request failed with status ${status}.`);
    this.name = 'ApiError';
  }
}

/** Stores the token from a `#token=` fragment; returns whether the hash held one. */
export function captureToken(hash: string, store: TokenStore): boolean {
  const match = TOKEN_FRAGMENT.exec(hash);
  if (match === null) return false;
  store.setItem(TOKEN_KEY, match[1]);
  return true;
}

function errorFromResponse(status: number, text: string): ApiError {
  if (status === 403 || text === '') return new ApiError(status, 'forbidden', []);
  try {
    const body = JSON.parse(text) as { error?: unknown; issues?: unknown };
    const kind = typeof body.error === 'string' ? body.error : 'failed';
    const issues = Array.isArray(body.issues) ? body.issues.filter((issue): issue is string => typeof issue === 'string') : [];
    return new ApiError(status, kind, issues);
  } catch {
    return new ApiError(status, 'failed', []);
  }
}

export function createApiClient(store: TokenStore, fetchImpl: typeof fetch) {
  return {
    async request<T>(method: ApiMethod, path: string, body?: unknown): Promise<T> {
      const token = store.getItem(TOKEN_KEY);
      if (token === null) {
        throw new ApiError(0, 'no-token', ['Open the page with the link routemax ui prints: it carries the access token.']);
      }
      const headers: Record<string, string> = { [TOKEN_HEADER]: token };
      if (method !== 'GET') headers['content-type'] = 'application/json';
      const response = await fetchImpl(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      if (!response.ok) throw errorFromResponse(response.status, await response.text());
      return (await response.json()) as T;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
