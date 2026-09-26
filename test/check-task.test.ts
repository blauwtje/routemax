import { describe, expect, it, vi } from 'vitest';
import { checkTask, type CheckTaskTarget } from '../src/routing/check-task';

const TARGET: CheckTaskTarget = {
  baseUrl: 'https://api.deepseek.example',
  apiKey: 'secret-key',
  model: 'deepseek-chat',
  price: { inputUsd: 1, cacheHitUsd: 0.5, outputUsd: 2 },
};

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe('checkTask', () => {
  it('posts one Anthropic-format request and returns the parsed classification with its cost', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: '{"tier": "flash-high", "effort": "medium"}' }],
        usage: { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      }),
    );

    const result = await checkTask('unclear task text', TARGET, 5_000, fetchImpl);

    expect(result).toEqual({ tier: 'flash-high', effort: 'medium', costUsd: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.deepseek.example/v1/messages');
    expect(init.headers['x-api-key']).toBe('secret-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('deepseek-chat');
    expect(body.messages).toEqual([{ role: 'user', content: 'unclear task text' }]);
  });

  it('never logs the api key even on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down: key secret-key rejected'));

    const result = await checkTask('unclear task text', TARGET, 5_000, fetchImpl);

    expect(result).toBeNull();
    const logged = [...consoleSpy.mock.calls, ...consoleLogSpy.mock.calls].flat().join(' ');
    expect(logged).not.toContain('secret-key');
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('returns null when the response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false));

    const result = await checkTask('task', TARGET, 5_000, fetchImpl);

    expect(result).toBeNull();
  });

  it('returns null when the reply text is not valid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ content: [{ type: 'text', text: 'not json' }] }));

    const result = await checkTask('task', TARGET, 5_000, fetchImpl);

    expect(result).toBeNull();
  });

  it('returns null when the reply names an unknown tier or effort', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ content: [{ type: 'text', text: '{"tier": "unknown", "effort": "medium"}' }] }),
    );

    const result = await checkTask('task', TARGET, 5_000, fetchImpl);

    expect(result).toBeNull();
  });

  it('returns null when fetch rejects with a timeout', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'TimeoutError'));

    const result = await checkTask('task', TARGET, 50, fetchImpl);

    expect(result).toBeNull();
  });
});
