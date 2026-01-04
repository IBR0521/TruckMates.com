"use client"

import { useEffect } from "react"

export function SkipLink({ targetId = "main-content", label = "Skip to main content" }: { targetId?: string; label?: string }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow skip link to be activated with Enter or Space
      if (e.key === "Enter" || e.key === " ") {
        const target = document.getElementById(targetId)
        if (target) {
          e.preventDefault()
          target.focus()
          target.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }
    }

    const skipLink = document.querySelector(`a[href="#${targetId}"]`)
    if (skipLink) {
      skipLink.addEventListener("keydown", handleKeyDown)
      return () => {
        skipLink.removeEventListener("keydown", handleKeyDown)
      }
    }
  }, [targetId])

  return null
}

