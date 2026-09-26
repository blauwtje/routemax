import * as React from "react"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type ToggleChipProps = React.ComponentProps<"input"> & {
  label: React.ReactNode
}

function ToggleChip({ label, className, id, ...props }: ToggleChipProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  return (
    <label
      htmlFor={inputId}
      data-slot="toggle-chip"
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        className
      )}
    >
      <input type="checkbox" id={inputId} className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className="toggle-chip-box relative flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-border-strong bg-well shadow-well transition-colors peer-checked:border-signal-on peer-checked:bg-signal-on peer-checked:shadow-none peer-checked:[&>svg]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-2"
      >
        <CheckIcon aria-hidden="true" className="size-3 text-background opacity-0 transition-opacity" />
      </span>
      {label}
    </label>
  )
}

export { ToggleChip }
