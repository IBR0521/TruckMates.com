"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface KeyboardShortcut {
  keys: string[]
  description: string
  action: () => void
  category: string
}

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const shortcuts: KeyboardShortcut[] = [
    // Navigation
    {
      keys: ["G", "D"],
      description: "Go to Dashboard",
      action: () => router.push("/dashboard"),
      category: "Navigation",
    },
    {
      keys: ["G", "L"],
      description: "Go to Loads",
      action: () => router.push("/dashboard/loads"),
      category: "Navigation",
    },
    {
      keys: ["G", "R"],
      description: "Go to Routes",
      action: () => router.push("/dashboard/routes"),
      category: "Navigation",
    },
    {
      keys: ["G", "T"],
      description: "Go to Trucks",
      action: () => router.push("/dashboard/trucks"),
      category: "Navigation",
    },
    {
      keys: ["G", "E"],
      description: "Go to Employees",
      action: () => router.push("/dashboard/employees"),
      category: "Navigation",
    },
    {
      keys: ["G", "S"],
      description: "Go to Settings",
      action: () => router.push("/dashboard/settings"),
      category: "Navigation",
    },
    
    // Actions
    {
      keys: ["N"],
      description: "New Item (context-aware)",
      action: () => {
        const path = window.location.pathname
        if (path.includes("/loads")) router.push("/dashboard/loads/add")
        else if (path.includes("/routes")) router.push("/dashboard/routes/add")
        else if (path.includes("/trucks")) router.push("/dashboard/trucks/add")
        else if (path.includes("/drivers")) router.push("/dashboard/drivers/add")
      },
      category: "Actions",
    },
    {
      keys: ["/"],
      description: "Focus Search",
      action: () => {
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search" i]') as HTMLInputElement
        searchInput?.focus()
      },
      category: "Actions",
    },
    {
      keys: ["?"],
      description: "Show Keyboard Shortcuts",
      action: () => setOpen(true),
      category: "Actions",
    },
    {
      keys: ["Escape"],
      description: "Close Dialog / Clear Selection",
      action: () => {
        const dialog = document.querySelector('[role="dialog"]')
        if (dialog) {
          const closeButton = dialog.querySelector('button[aria-label*="close" i], button[aria-label*="Close" i]')
          if (closeButton instanceof HTMLButtonElement) closeButton.click()
        }
      },
      category: "Actions",
    },
  ]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return
      }

      // Cmd+K or Ctrl+K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }

      // Handle other shortcuts
      shortcuts.forEach((shortcut) => {
        if (shortcut.keys.length === 1 && e.key === shortcut.keys[0] && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault()
          shortcut.action()
        } else if (shortcut.keys.length === 2) {
          // Two-key shortcuts (e.g., "G" then "D")
          // This is simplified - in production, you'd want a more sophisticated handler
        }
      })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router])

  return (
    <>
      {children}
      <KeyboardShortcutsDialog open={open} onOpenChange={setOpen} shortcuts={shortcuts} />
    </>
  )
}

function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortcuts: KeyboardShortcut[]
}) {
  const categories = Array.from(new Set(shortcuts.map((s) => s.category)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and perform actions quickly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 mt-4">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-foreground mb-3">{category}</h3>
              <div className="space-y-2">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted"
                    >
                      <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <Badge variant="outline" className="font-mono text-xs">
                              {key === " " ? "Space" : key}
                            </Badge>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd> to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Simple command palette component
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <Command>
          <Command.Input placeholder="Type a command or search..." />
          <Command.List>
            <Command.Empty>No results found.</Command.Empty>
            <Command.Group heading="Navigation">
              <Command.Item onSelect={() => { router.push("/dashboard"); setOpen(false) }}>
                Dashboard
              </Command.Item>
              <Command.Item onSelect={() => { router.push("/dashboard/loads"); setOpen(false) }}>
                Loads
              </Command.Item>
              <Command.Item onSelect={() => { router.push("/dashboard/routes"); setOpen(false) }}>
                Routes
              </Command.Item>
              <Command.Item onSelect={() => { router.push("/dashboard/trucks"); setOpen(false) }}>
                Trucks
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

