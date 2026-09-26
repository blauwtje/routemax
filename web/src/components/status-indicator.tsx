import { cn } from "@/lib/utils"

type StatusValue =
  | "done"
  | "escalate"
  | "use_claude"
  | "refused"
  | "disabled"
  | "ok"
  | "fail"
  | "present"
  | "absent"
  | "passed"
  | "failed"
  | "enabled"

type Tone = "positive" | "attention" | "info" | "negative" | "neutral"

const STATUS_MAP: Record<StatusValue, { tone: Tone; label: string }> = {
  done: { tone: "positive", label: "Done" },
  escalate: { tone: "attention", label: "Escalate" },
  use_claude: { tone: "info", label: "Use Claude" },
  refused: { tone: "negative", label: "Refused" },
  disabled: { tone: "neutral", label: "Disabled" },
  ok: { tone: "positive", label: "OK" },
  fail: { tone: "negative", label: "Fail" },
  present: { tone: "positive", label: "Present" },
  absent: { tone: "neutral", label: "Absent" },
  passed: { tone: "positive", label: "Passed" },
  failed: { tone: "negative", label: "Failed" },
  enabled: { tone: "positive", label: "Enabled" },
}

type StatusIndicatorProps = {
  value: StatusValue
  label?: string
  className?: string
}

function StatusIndicator({ value, label, className }: StatusIndicatorProps) {
  const entry = STATUS_MAP[value]
  return (
    <span
      data-slot="status-indicator"
      className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-foreground", className)}
    >
      <span
        aria-hidden="true"
        data-tone={entry.tone}
        className="size-2 shrink-0 rounded-full data-[tone=positive]:bg-status-positive data-[tone=attention]:bg-status-attention data-[tone=info]:bg-status-info data-[tone=negative]:bg-status-negative data-[tone=neutral]:bg-status-neutral"
      />
      {label ?? entry.label}
    </span>
  )
}

export { StatusIndicator, type StatusValue }
