"use client"

import type React from "react"

import { useState } from "react"
import { Menu, LogOut } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Sidebar from "@/components/dashboard/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation - Shared across all dashboard pages */}
        <header className="border-b border-border bg-gradient-to-r from-card to-card/50 backdrop-blur px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-secondary rounded-lg transition"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </Link>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background/50">{children}</main>
      </div>
    </div>
  )
}
