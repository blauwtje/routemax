export type TierColorKey = "flash-low" | "flash-high" | "pro-high" | "claude"

type TierColors = {
  dot: string
  tint: string
  text: string
}

const TIER_COLORS: Record<TierColorKey, TierColors> = {
  "flash-low": { dot: "bg-tier-flash-low", tint: "bg-tier-flash-low-tint", text: "text-tier-flash-low-text" },
  "flash-high": { dot: "bg-tier-flash-high", tint: "bg-tier-flash-high-tint", text: "text-tier-flash-high-text" },
  "pro-high": { dot: "bg-tier-pro-high", tint: "bg-tier-pro-high-tint", text: "text-tier-pro-high-text" },
  claude: { dot: "bg-tier-claude", tint: "bg-tier-claude-tint", text: "text-tier-claude-text" },
}

const NEUTRAL_TIER_COLORS: TierColors = {
  dot: "bg-status-neutral",
  tint: "bg-status-neutral-tint",
  text: "text-status-neutral",
}

/** Looks up a tier's dot/tint/text classes; an unrecognized tier name falls back to neutral. */
function getTierColors(tier: string): TierColors {
  return TIER_COLORS[tier as TierColorKey] ?? NEUTRAL_TIER_COLORS
}

export { getTierColors }
