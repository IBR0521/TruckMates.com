"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Menu, LogOut } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Sidebar from "@/components/dashboard/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { FeedbackWidget } from "@/components/feedback-widget"
import { NotificationsCenter } from "@/components/notifications-center"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getCurrentUser } from "@/app/actions/user"
// AI Widget temporarily disabled - not ready for production
// const FloatingAIWidget = dynamic(
//   () => import("@/components/truckmates-ai/floating-widget"),
//   { 
//     ssr: false
//   }
// )

export default function DashboardLayout({
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
        setSidebarCollapsed(JSON.parse(saved))
      }
    }
  }, [])

  // Save sidebar collapse state to localStorage and handle resize - client only
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

    if (window.innerWidth >= 1024) {
      localStorage.setItem("sidebarCollapsed", JSON.stringify(sidebarCollapsed))
    }

    return () => window.removeEventListener("resize", handleResize)
  }, [sidebarCollapsed, mounted])

  // Check if user has a company_id, redirect to account setup if not
  useEffect(() => {
    async function checkCompanyAccess() {
      try {
        // Skip check if we're already on account setup page
        if (typeof window !== "undefined" && window.location.pathname.includes("/account-setup")) {
          return
        }

        const userResult = await getCurrentUser()
        if (userResult.data) {
          const user = userResult.data
          // Super Admin and manager always have company (they create it), so skip check for them
          if (user.role === "super_admin" || user.role === "manager") {
            return
          }
          // For other roles, check if they have a company_id
          if (!user.company_id) {
            // User doesn't have a company, redirect to account setup
            router.push("/account-setup/user")
          }
        }
      } catch (error) {
        console.error("Error checking company access:", error)
      }
    }
    if (mounted) {
      // Add a small delay to avoid race conditions with page navigation
      const timeoutId = setTimeout(checkCompanyAccess, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [mounted, router])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation - Shared across all dashboard pages */}
        <header className="border-b border-border bg-gradient-to-r from-card to-card/50 backdrop-blur px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
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
                    toast.error("Failed to logout: " + error.message)
                  } else {
                    toast.success("Logged out successfully")
                    router.push("/login")
                    router.refresh()
                  }
                } catch (error: any) {
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

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-auto bg-background/50" role="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Floating Feedback Widget */}
      <FeedbackWidget />
      
      {/* Floating AI Widget - Right side */}
      {/* Temporarily disabled - AI feature not ready for production */}
      {/* <FloatingAIWidget /> */}
    </div>
  )
}
