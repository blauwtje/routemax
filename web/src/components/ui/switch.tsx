import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default" | "lg"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-lg border border-transparent shadow-well outline-none transition-[background-color,border-color,box-shadow] ease-out-expo group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:shadow-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-[size=lg]:h-6 data-[size=lg]:w-11 data-[size=lg]:px-0.5 data-[size=lg]:data-checked:border-transparent data-[size=lg]:data-checked:bg-signal-on data-[size=lg]:data-checked:shadow-[0_0_12px_color-mix(in_oklch,var(--signal-on)_40%,transparent)] data-[size=lg]:data-unchecked:border-transparent data-[size=lg]:data-unchecked:bg-switch-off data-checked:bg-signal-on data-unchecked:bg-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-md bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=lg]/switch:size-5 group-data-[size=lg]/switch:duration-(--dur-toggle) group-data-[size=lg]/switch:ease-[var(--ease-spring)] group-data-[size=lg]/switch:motion-reduce:transition-none group-data-[size=lg]/switch:data-checked:translate-x-full group-data-[size=lg]/switch:data-checked:bg-background group-data-[size=lg]/switch:data-unchecked:bg-foreground group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
