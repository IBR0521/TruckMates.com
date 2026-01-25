"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in inputs
      const target = event.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      shortcuts.forEach((shortcut) => {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault()
          shortcut.action()
        }
      })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts, enabled])
}

// Common keyboard shortcuts for list pages
export function useListPageShortcuts(
  router: ReturnType<typeof useRouter>,
  addPath: string,
  searchRef?: React.RefObject<HTMLInputElement>
) {
  useKeyboardShortcuts(
    [
      {
        key: "n",
        ctrl: true,
        action: () => router.push(addPath),
        description: "Create new item",
      },
      {
        key: "f",
        ctrl: true,
        action: () => {
          if (searchRef?.current) {
            searchRef.current.focus()
          }
        },
        description: "Focus search",
      },
      {
        key: "Escape",
        action: () => {
          if (searchRef?.current) {
            searchRef.current.blur()
          }
        },
        description: "Clear search focus",
      },
    ],
    true
  )
}


