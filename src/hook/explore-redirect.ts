export interface HookInput {
  tool_name?: string;
  tool_input?: { subagent_type?: unknown };
}

export interface HookDeny {
  hookSpecificOutput: { hookEventName: 'PreToolUse'; permissionDecision: 'deny'; permissionDecisionReason: string };
}

export const EXPLORE_REDIRECT_REASON =
  'Explore is redirected to DeepSeek: call the deepseek-delegate MCP tool delegate with taskType "search" and your search question as task instead.';

export function exploreRedirect(input: HookInput, options: { enabled: boolean; depth: number }): HookDeny | null {
  if (!options.enabled || options.depth >= 1) return null;
  if (input.tool_name !== 'Agent' || input.tool_input?.subagent_type !== 'Explore') return null;
  return {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: EXPLORE_REDIRECT_REASON },
  };
}
