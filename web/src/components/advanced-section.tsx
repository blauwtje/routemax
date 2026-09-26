import * as React from "react"
import { ChevronRight } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type AdvancedSectionProps = {
  title?: string
  summary: string
  children: React.ReactNode
  className?: string
}

/**
 * The one fold a page keeps its rarely used settings behind: closed by default and never
 * nested, so every setting stays one click away. The summary names what the fold holds, so
 * nobody has to open it to find out.
 */
function AdvancedSection({ title = "Advanced", summary, children, className }: AdvancedSectionProps) {
  return (
    <Collapsible
      data-slot="advanced-section"
      className={cn("rounded-lg border border-border bg-surface-1 shadow-panel", className)}
    >
      <CollapsibleTrigger className="group/advanced flex min-h-11 w-full items-center gap-3 rounded-lg px-4 py-3 text-left outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-expo group-data-[panel-open]/advanced:rotate-90"
        />
        <span className="text-[15px] font-semibold text-foreground">{title}</span>
        <span className="min-w-0 truncate text-sm text-muted-foreground">{summary}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out-expo data-[ending-style]:h-0 data-[starting-style]:h-0">
        <div className="flex flex-col gap-6 border-t border-border px-4 pt-4 pb-5 sm:px-6">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { AdvancedSection }
