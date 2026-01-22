import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ 
  className, 
  type, 
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  id,
  ...props 
}: React.ComponentProps<'input'>) {
  // Accessibility: Ensure input has proper labeling
  const hasLabel = props['aria-labelledby'] || ariaLabel || id
  
  return (
    <input
      type={type}
      id={id}
      data-slot="input"
      aria-label={!hasLabel && props.placeholder ? props.placeholder : ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-input border-input h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        // Hide number input spinners to allow manual typing
        type === 'number' && '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
