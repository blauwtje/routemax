#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

const port = Number(process.env.FAKE_UPSTREAM_PORT ?? 18787);
const modeFile = process.env.FAKE_UPSTREAM_MODE_FILE;
const expectedAuth = process.env.FAKE_UPSTREAM_EXPECTED_AUTH;
const usage = { input_tokens: 1000, output_tokens: 1, cache_read_input_tokens: 200, cache_creation_input_tokens: 0 };
let messageCount = 0;

const mode = () => (modeFile && existsSync(modeFile) ? readFileSync(modeFile, 'utf8').trim() : 'ok');

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function sendError(response, status, type, message) {
  sendJson(response, status, { type: 'error', error: { type, message } });
}

function textOf(message) {
  if (typeof message.content === 'string') return message.content;
  return message.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
}

function replyBlocks(request) {
  // claude -p appends role:"system" reminder messages after the tool_result turn.
  const last = request.messages.findLast((message) => message.role !== 'system');
  const hasToolResult = Array.isArray(last.content) && last.content.some((block) => block.type === 'tool_result');
  if (hasToolResult) return [{ type: 'text', text: 'Wrote the requested files.' }];
  const paths = request.tools?.length ? [...new Set(textOf(request.messages[0]).match(/\/[\w./-]+\.txt/g) ?? [])] : [];
  if (!paths.length) return [{ type: 'text', text: 'Nothing to do.' }];
  return paths.map((filePath, index) => ({
    type: 'tool_use',
    id: `toolu_fake_${messageCount}_${index}`,
    name: 'Write',
    input: { file_path: filePath, content: 'hello\n' },
  }));
}

function streamEvents(message) {
  const events = [{ type: 'message_start', message: { ...message, content: [], stop_reason: null } }];
  message.content.forEach((block, index) => {
    if (block.type === 'text') {
      events.push({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
      events.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } });
    } else {
      events.push({ type: 'content_block_start', index, content_block: { ...block, input: {} } });
      events.push({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } });
    }
    events.push({ type: 'content_block_stop', index });
  });
  events.push({ type: 'message_delta', delta: { stop_reason: message.stop_reason, stop_sequence: null }, usage: { output_tokens: 50 } });
  events.push({ type: 'message_stop' });
  return events;
}

function answer(response, request) {
  messageCount += 1;
  const content = replyBlocks(request);
  const message = {
    id: `msg_fake_${messageCount}`,
    type: 'message',
    role: 'assistant',
    model: request.model,
    content,
    stop_reason: content.some((block) => block.type === 'tool_use') ? 'tool_use' : 'end_turn',
    stop_sequence: null,
    usage,
  };
  if (!request.stream) return sendJson(response, 200, message);
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const event of streamEvents(message)) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  response.end();
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/healthz') return sendJson(response, 200, { ok: true });
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    if (expectedAuth && request.headers.authorization !== expectedAuth) {
      return sendError(response, 401, 'authentication_error', 'unexpected credentials');
    }
    if (url.pathname === '/v1/messages/count_tokens') return sendJson(response, 200, { input_tokens: 10 });
    if (url.pathname !== '/v1/messages') return sendError(response, 404, 'not_found_error', url.pathname);
    if (mode() === 'broken') return sendError(response, 400, 'invalid_request_error', 'fake upstream is broken');
    answer(response, JSON.parse(body));
  });
});

server.listen(port, '127.0.0.1', () => {
  if (process.env.FAKE_UPSTREAM_PID_FILE) writeFileSync(process.env.FAKE_UPSTREAM_PID_FILE, String(process.pid));
});
