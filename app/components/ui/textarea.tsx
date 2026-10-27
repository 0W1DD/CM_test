import * as React from "react"

import { cn } from "~/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground/80 focus-visible:border-primary/50 focus-visible:ring-ring/40 aria-invalid:ring-destructive/30 dark:aria-invalid:ring-destructive/50 aria-invalid:border-destructive bg-card/70 dark:bg-card/40 flex field-sizing-content min-h-20 w-full rounded-2xl border px-4 py-3 text-base transition-[color,box-shadow,border-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
