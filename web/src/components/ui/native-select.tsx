import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

function NativeSelect({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "default" | "compact" }) {
  return (
    <div className="relative" data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "w-full min-w-0 appearance-none rounded-md border border-border bg-well pr-8 pl-2.5 text-sm text-foreground shadow-well outline-none transition-colors ease-out-expo data-[size=default]:h-10 data-[size=compact]:h-8 data-[size=compact]:text-[13px] hover:border-border-strong focus-visible:border-ring focus-visible:bg-card focus-visible:shadow-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          className
        )}
        {...props}
      />
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { NativeSelect }
