import { cn } from "@/lib/utils"
import { getTierColors } from "@/lib/tier-colors"

type TierChipProps = {
  tier: string
  label?: string
  className?: string
}

function TierChip({ tier, label, className }: TierChipProps) {
  const colors = getTierColors(tier)
  return (
    <span data-slot="tier-chip" className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn("tier-chip-dot size-1.5 shrink-0 rounded-full shadow-[0_0_6px_currentColor]", colors.dot, colors.text)}
      />
      <span className="font-mono text-[13px] text-foreground">{label ?? tier}</span>
    </span>
  )
}

export { TierChip }
