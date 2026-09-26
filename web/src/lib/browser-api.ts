import { createApiClient } from './api-client';

export const api = createApiClient(window.sessionStorage, (input, init) => window.fetch(input, init));
