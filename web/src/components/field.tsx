import * as React from "react"
import { cn } from "@/lib/utils"

type ControlProps = {
  id?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  className?: string
}

type FieldProps = {
  label: React.ReactNode
  htmlFor: string
  help?: React.ReactNode
  error?: React.ReactNode
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  className?: string
  children: React.ReactElement<ControlProps>
}

function Field({ label, htmlFor, help, error, prefix, suffix, className, children }: FieldProps) {
  const helpId = help ? `${htmlFor}-help` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined
  const describedBy =
    [children.props["aria-describedby"], helpId, errorId].filter(Boolean).join(" ") || undefined

  const control = React.cloneElement(children, {
    id: htmlFor,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    "aria-describedby": describedBy,
    className: cn(children.props.className, prefix && "pl-7", suffix && "pr-14"),
  })

  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-slot="field">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-foreground">
        {label}
      </label>
      {prefix || suffix ? (
        <div className="relative flex items-center" data-slot="field-well">
          {prefix && (
            <span
              className="pointer-events-none absolute left-2.5 font-mono text-sm text-muted-foreground"
              data-slot="field-prefix"
            >
              {prefix}
            </span>
          )}
          {control}
          {suffix && (
            <span
              className="pointer-events-none absolute right-2.5 font-mono text-sm text-muted-foreground"
              data-slot="field-suffix"
            >
              {suffix}
            </span>
          )}
        </div>
      ) : (
        control
      )}
      {help && !error && (
        <p id={helpId} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export { Field }
