import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WorkerStream } from '../src/worker/stream-state';

const PRICES = { 'deepseek-v4-flash': { inputUsd: 0.3, cacheHitUsd: 0.03, outputUsd: 1.2 } };
const sample = readFileSync(new URL('./fixtures/stream-sample.jsonl', import.meta.url), 'utf8');

const usage = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const assistant = (id: string, content: unknown[]) =>
  JSON.stringify({ type: 'assistant', message: { id, model: 'deepseek-v4-flash', content, usage } });
const toolUse = (id: string, name: string, filePath: string) => ({ type: 'tool_use', id, name, input: { file_path: filePath } });
const toolResult = (toolUseId: string, isError: boolean) =>
  JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, is_error: isError }] } });

function parse(lines: string[]): WorkerStream {
  const stream = new WorkerStream();
  for (const line of lines) stream.accept(line);
  return stream;
}

describe('WorkerStream', () => {
  it('reads the recorded claude -p run: result, usage and only the write that landed', () => {
    const stream = parse(sample.split('\n'));
    expect(stream.result).toMatchObject({ isError: false, subtype: 'success', text: 'Wrote the requested files.' });
    expect(stream.changedFiles).toHaveLength(1);
    expect(stream.changedFiles[0]).toMatch(/\/work\/hello\.txt$/);
    expect(stream.usage.inputTokens).toBeGreaterThan(0);
    expect(stream.costUsd(PRICES, 'deepseek-v4-flash')).toBeGreaterThan(0);
  });

  it('drops a denied write, ignores reads and keeps a write that never got a result', () => {
    const stream = parse([
      assistant('msg_1', [
        toolUse('t1', 'Write', '/w/a.txt'),
        toolUse('t2', 'Edit', '/w/b.txt'),
        toolUse('t3', 'Read', '/w/c.txt'),
        toolUse('t4', 'Write', '/w/d.txt'),
      ]),
      toolResult('t1', false),
      toolResult('t2', true),
    ]);
    expect(stream.changedFiles).toEqual(['/w/a.txt', '/w/d.txt']);
  });

  it('counts a message that arrives in several events once', () => {
    const stream = parse([assistant('msg_1', [{ type: 'text', text: 'a' }]), assistant('msg_1', [{ type: 'text', text: 'b' }])]);
    expect(stream.usage.inputTokens).toBe(1000);
    expect(stream.costUsd(PRICES, 'deepseek-v4-flash')).toBeCloseTo((1000 * 0.3 + 100 * 1.2) / 1_000_000, 12);
  });

  it('marks an error result and skips lines that are not JSON', () => {
    const stream = parse(['warning: not json', JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true })]);
    expect(stream.result).toEqual({ isError: true, subtype: 'error_during_execution', text: '', usage: null });
  });
});
