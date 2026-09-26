import * as React from "react"
import { cn } from "@/lib/utils"

type SettingsGroupProps = {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}

function SettingsGroup({ title, description, children, className }: SettingsGroupProps) {
  return (
    <section
      data-slot="settings-group"
      className={cn(
        "flex flex-col gap-4 border-t border-border pt-4",
        className
      )}
    >
      <div className="flex flex-col gap-1.5" data-slot="settings-group-header">
        <h3 className="text-[17px] font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="max-w-[60ch] text-sm text-muted-foreground text-pretty">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4" data-slot="settings-group-fields">
        {children}
      </div>
    </section>
  )
}

export { SettingsGroup }
