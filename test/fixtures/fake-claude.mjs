#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const env = process.env;
const scenario = env.FAKE_CLAUDE_SCENARIO ?? 'success';

if (env.FAKE_CLAUDE_RECORD) {
  writeFileSync(
    env.FAKE_CLAUDE_RECORD,
    JSON.stringify({
      args: process.argv.slice(2),
      cwd: process.cwd(),
      depth: env.DEEPSEEK_DELEGATE_DEPTH,
      model: env.ANTHROPIC_MODEL,
      subagentModel: env.CLAUDE_CODE_SUBAGENT_MODEL,
      effort: env.CLAUDE_CODE_EFFORT_LEVEL,
      hasAuthToken: Boolean(env.ANTHROPIC_AUTH_TOKEN),
      hasApiKey: 'ANTHROPIC_API_KEY' in env,
    }),
  );
}
if (env.FAKE_CLAUDE_RETRIES && env.FAKE_CLAUDE_TELEMETRY) {
  const retries = Array.from({ length: Number(env.FAKE_CLAUDE_RETRIES) }, () => ({ reason: 'empty-completion' }));
  appendFileSync(env.FAKE_CLAUDE_TELEMETRY, `${JSON.stringify({ ts: new Date().toISOString(), retries })}\n`);
}

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
const usage = (input, output) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
const assistant = (id, content, input = 100, output = 10) =>
  emit({ type: 'assistant', message: { id, model: env.ANTHROPIC_MODEL, content, usage: usage(input, output) } });
const result = (fields = {}) =>
  emit({ type: 'result', subtype: 'success', is_error: false, result: 'Did the thing.', usage: usage(200, 20), ...fields });

emit({ type: 'system', subtype: 'init' });
switch (scenario) {
  case 'success':
    assistant('msg_1', [{ type: 'tool_use', id: 'toolu_1', name: 'Write', input: { file_path: join(process.cwd(), 'a.txt'), content: 'a\n' } }]);
    emit({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }] } });
    assistant('msg_2', [{ type: 'text', text: 'Did the thing.' }]);
    result();
    break;
  case 'exit-code':
    result();
    process.exitCode = 3;
    break;
  case 'stream-error':
    result({ subtype: 'error_during_execution', is_error: true, result: undefined });
    break;
  case 'empty-result':
    result({ result: '' });
    break;
  case 'expensive': {
    let count = 0;
    setInterval(() => assistant(`msg_${count++}`, [{ type: 'text', text: '.' }], 200_000, 0), 50);
    break;
  }
  case 'hang':
    setInterval(() => {}, 1_000);
    break;
  default:
    process.exitCode = 64;
}
