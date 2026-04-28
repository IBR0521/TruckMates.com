"use client"

import { useEffect, useState } from "react"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function FirstHoverTooltip({
  tooltipKey,
  text,
}: {
  tooltipKey: string
  text: string
}) {
  const storageKey = `tm:first-hover:${tooltipKey}`
  const [shouldShow, setShouldShow] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey) === "1"
      setShouldShow(!seen)
    } catch {
      setShouldShow(true)
    }
  }, [storageKey])

  const handleHover = () => {
    if (!shouldShow) return
    setOpen(true)
    try {
      localStorage.setItem(storageKey, "1")
    } catch {}
    setShouldShow(false)
  }

  if (!shouldShow) return null

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Help"
            onMouseEnter={handleHover}
            onFocus={handleHover}
            className="ml-1 inline-flex align-middle text-muted-foreground hover:text-foreground"
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
