import { addUsage, EMPTY_USAGE, usageCostUsd, type TokenUsage } from '../budget/usage-cost';
import type { ModelPrice } from '../config/config-schema';

interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface ContentBlock {
  type?: string;
  id?: string;
  name?: string;
  input?: { file_path?: unknown };
  tool_use_id?: string;
  is_error?: boolean;
}

interface StreamEvent {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: unknown;
  usage?: RawUsage;
  message?: { id?: string; model?: string; usage?: RawUsage; content?: unknown };
}

export interface WorkerResult {
  isError: boolean;
  subtype: string;
  text: string;
  usage: TokenUsage | null;
}

const FILE_WRITING_TOOLS = new Set(['Edit', 'Write']);

function toUsage(raw: RawUsage): TokenUsage {
  return {
    inputTokens: raw.input_tokens ?? 0,
    outputTokens: raw.output_tokens ?? 0,
    cacheReadTokens: raw.cache_read_input_tokens ?? 0,
    cacheCreationTokens: raw.cache_creation_input_tokens ?? 0,
  };
}

function contentBlocks(event: StreamEvent): ContentBlock[] {
  const content = event.message?.content;
  return Array.isArray(content) ? (content as ContentBlock[]) : [];
}

function parseEvent(line: string): StreamEvent | null {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line) as StreamEvent;
  } catch {
    // claude can print non-JSON diagnostics on stdout; only JSON events count.
    return null;
  }
}

export class WorkerStream {
  result: WorkerResult | null = null;
  private readonly usageByMessage = new Map<string, { model: string; usage: TokenUsage }>();
  private readonly pendingWrites = new Map<string, string>();
  private readonly confirmedWrites = new Set<string>();

  accept(line: string): void {
    const event = parseEvent(line);
    if (event?.type === 'assistant') this.acceptAssistant(event);
    if (event?.type === 'user') this.acceptToolResults(event);
    if (event?.type === 'result') {
      this.result = {
        isError: event.is_error === true || event.subtype !== 'success',
        subtype: event.subtype ?? 'unknown',
        text: typeof event.result === 'string' ? event.result : '',
        usage: event.usage ? toUsage(event.usage) : null,
      };
    }
  }

  get changedFiles(): string[] {
    return [...new Set([...this.confirmedWrites, ...this.pendingWrites.values()])].sort();
  }

  get usage(): TokenUsage {
    const streamed = [...this.usageByMessage.values()].reduce((sum, entry) => addUsage(sum, entry.usage), EMPTY_USAGE);
    return this.result?.usage ?? streamed;
  }

  costUsd(prices: Record<string, ModelPrice>, tierModel: string): number {
    const tierPrice = prices[tierModel];
    const streamed = [...this.usageByMessage.values()].reduce(
      (sum, entry) => sum + usageCostUsd(prices[entry.model] ?? tierPrice, entry.usage),
      0,
    );
    const reported = this.result?.usage ? usageCostUsd(tierPrice, this.result.usage) : 0;
    return Math.max(streamed, reported);
  }

  private acceptAssistant(event: StreamEvent): void {
    const message = event.message;
    if (message?.id && message.usage) {
      this.usageByMessage.set(message.id, { model: message.model ?? '', usage: toUsage(message.usage) });
    }
    for (const block of contentBlocks(event)) {
      const filePath = block.input?.file_path;
      if (block.type === 'tool_use' && block.id && FILE_WRITING_TOOLS.has(block.name ?? '') && typeof filePath === 'string') {
        this.pendingWrites.set(block.id, filePath);
      }
    }
  }

  private acceptToolResults(event: StreamEvent): void {
    for (const block of contentBlocks(event)) {
      if (block.type !== 'tool_result' || !block.tool_use_id) continue;
      const filePath = this.pendingWrites.get(block.tool_use_id);
      if (filePath === undefined) continue;
      this.pendingWrites.delete(block.tool_use_id);
      if (block.is_error !== true) this.confirmedWrites.add(filePath);
    }
  }
}
