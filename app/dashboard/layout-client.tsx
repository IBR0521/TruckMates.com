"use client"

import type React from "react"

import dynamic from "next/dynamic"
import { useState, useEffect } from "react"
import { Menu, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import Sidebar from "@/components/dashboard/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { FeedbackWidget } from "@/components/feedback-widget"
import { NotificationsCenter } from "@/components/notifications-center"
import { FcmTokenRegistrar } from "@/components/notifications/fcm-token-registrar"
import { DemoSessionBanner } from "@/components/dashboard/demo-session-banner"
import { DashboardBillingBanners } from "@/components/billing/dashboard-billing-banners"
import { AiQuotaBanner } from "@/components/billing/ai-quota-banner"
import { TrialHeaderBadge } from "@/components/billing/trial-header-badge"
import { DashboardShellProvider } from "@/components/dashboard/shell-bootstrap-provider"
import { ProactiveRecommendationsPanel } from "@/components/ai/proactive-recommendations-panel"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const AiChatWidget = dynamic(
  () => import("@/components/ai/chat-widget").then((m) => m.AiChatWidget),
  { ssr: false, loading: () => null },
)

const FirstLoginTour = dynamic(
  () => import("@/components/onboarding/first-login-tour").then((m) => m.FirstLoginTour),
  { ssr: false, loading: () => null },
)

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Load sidebar collapse state from localStorage (only on desktop) - client only
  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed")
      if (saved !== null && window.innerWidth >= 1024) {
        try {
          setSidebarCollapsed(JSON.parse(saved))
        } catch (error) {
          console.error("[DashboardLayout] Error parsing sidebar state:", error)
          // Use default value on parse error
        }
      }
    }
  }, [])

  // Save sidebar collapse state to localStorage and handle resize - client only
  // V3-005 FIX: Remove sidebarCollapsed from deps to prevent infinite render loop
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return

    const handleResize = () => {
      // On mobile/tablet (below lg breakpoint), always show full sidebar
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(false)
      }
    }

    window.addEventListener("resize", handleResize)
    handleResize() // Check on mount

    // Use a ref to track previous width to avoid re-renders
    let previousWidth = window.innerWidth
    const checkAndSave = () => {
      if (window.innerWidth >= 1024 && window.innerWidth !== previousWidth) {
        localStorage.setItem("sidebarCollapsed", JSON.stringify(sidebarCollapsed))
        previousWidth = window.innerWidth
      }
    }
    
    // Only save to localStorage on resize, not on every sidebarCollapsed change
    const resizeHandler = () => {
      handleResize()
      checkAndSave()
    }
    
    window.addEventListener("resize", resizeHandler)

    return () => window.removeEventListener("resize", resizeHandler)
  }, [mounted]) // V3-005 FIX: Only depend on mounted, not sidebarCollapsed

  return (
    <DashboardShellProvider>
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden" data-dashboard-layout>
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Top Navigation - Shared across all dashboard pages */}
        <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-secondary rounded-lg transition"
              aria-label="Toggle sidebar"
              aria-expanded={sidebarOpen}
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <TrialHeaderBadge />
            <NotificationsCenter />
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-foreground" 
              aria-label="Logout"
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.signOut()
                  if (error) {
                    // Network fallback: clear local session even when Supabase is temporarily unreachable.
                    const fallback = await supabase.auth.signOut({ scope: "local" })
                    if (fallback.error) {
                      toast.error("Failed to logout: " + error.message)
                    } else {
                      toast.success("Logged out locally")
                      router.push("/login")
                      router.refresh()
                    }
                  } else {
                    toast.success("Logged out successfully")
                    router.push("/login")
                    router.refresh()
                  }
                } catch (error: unknown) {
                  toast.error("An error occurred during logout")
                  console.error("Logout error:", error)
                }
              }}
            >
              <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
              Logout
            </Button>
          </div>
        </header>

        <DemoSessionBanner />
        <DashboardBillingBanners />
        <AiQuotaBanner />

        {/* Page Content */}
        <main id="main-content" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background" role="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Persistent AI recommendations (Phase 2 UI surface) */}
      <ProactiveRecommendationsPanel />

      {/* Floating Feedback Widget */}
      <FeedbackWidget />
      <FirstLoginTour />
      <FcmTokenRegistrar />
      <AiChatWidget />
    </div>
    </DashboardShellProvider>
  )
}
