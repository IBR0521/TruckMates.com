"use client"

/**
 * Floating TruckMates AI Widget
 * Appears on the right side of the screen, always accessible
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, X, Minimize2, Maximize2 } from "lucide-react"
import { TruckMatesAIChat } from "./chat-interface"
import { cn } from "@/lib/utils"

function FloatingAIWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  return (
    <>
      {/* Floating Button - Always visible when closed */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            size="lg"
            className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all animate-pulse hover:animate-none"
            aria-label="Open TruckMates AI"
          >
            <Sparkles className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Chat Widget - Slides in from right */}
      {isOpen && (
        <div
          className={cn(
            "fixed right-6 z-50 transition-all duration-300 ease-in-out",
            isMinimized
              ? "bottom-6 w-80"
              : "bottom-6 w-[420px] h-[600px]"
          )}
        >
          <div className="bg-card border border-border rounded-xl shadow-2xl flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-card">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary rounded-lg">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Enterprise Logistics Intelligence</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsMinimized(!isMinimized)}
                  aria-label={isMinimized ? "Maximize" : "Minimize"}
                >
                  {isMinimized ? (
                    <Maximize2 className="w-4 h-4" />
                  ) : (
                    <Minimize2 className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Chat Interface */}
            {!isMinimized && (
              <div className="flex-1 overflow-hidden">
                <TruckMatesAIChat className="h-full" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default FloatingAIWidget

