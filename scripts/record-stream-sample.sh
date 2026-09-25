#!/bin/sh
REC="$(cd "$(mktemp -d)" && pwd -P)" && mkdir -p "$REC/cfg" "$REC/work" "$REC/outside" \
&& (FAKE_UPSTREAM_PORT=18787 node test/fixtures/fake-upstream.mjs & echo $! > "$REC/upstream.pid") \
&& sleep 1 \
&& (cd "$REC/work" && echo "Create the file $REC/work/hello.txt and also $REC/outside/escape.txt" \
  | env -i HOME="$HOME" PATH="$PATH" CLAUDE_CONFIG_DIR="$REC/cfg" ANTHROPIC_BASE_URL=http://127.0.0.1:18787 \
    ANTHROPIC_AUTH_TOKEN=sk-fake-recording ANTHROPIC_MODEL=deepseek-v4-flash ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash \
    claude -p --output-format stream-json --verbose --setting-sources user --strict-mcp-config \
      --mcp-config '{"mcpServers":{}}' --no-session-persistence --permission-mode acceptEdits \
      --permission-prompts none --tools Read,Grep,Glob,Edit,Write) > test/fixtures/stream-sample.jsonl; \
kill "$(cat "$REC/upstream.pid")"; ls "$REC/work" "$REC/outside"; grep -c '"type":"result"' test/fixtures/stream-sample.jsonl; grep -c 'sk-fake-recording' test/fixtures/stream-sample.jsonl
