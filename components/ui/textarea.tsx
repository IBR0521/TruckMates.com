import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'text-foreground border-2 border-border dark:border-border/80 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive aria-invalid:border-2 bg-secondary/50 dark:bg-secondary/30 flex field-sizing-content min-h-16 w-full rounded-md px-3 py-2 text-base shadow-md transition-[color,box-shadow,border-color,background-color] outline-none focus-visible:ring-[3px] focus-visible:ring-offset-0 hover:border-ring/70 hover:bg-secondary/70 dark:hover:bg-secondary/40 focus-visible:bg-secondary/80 dark:focus-visible:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
