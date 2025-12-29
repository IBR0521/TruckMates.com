// COMPLETE EXAMPLE: Drivers Page with Supabase
// This shows how to convert your mock data page to use real database

// ============================================
// OPTION 1: Server Component (Recommended)
// ============================================
// File: app/dashboard/drivers/page.tsx

import { getDrivers, deleteDriver } from "@/app/actions/drivers"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Edit2, Trash2, Eye, Download } from "lucide-react"
import Link from "next/link"
import { exportToExcel } from "@/lib/export-utils"
import { DeleteDriverButton } from "./delete-button" // Client component for delete

export default async function DriversPage() {
  // Check authentication
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch drivers from database
  const { data: drivers, error } = await getDrivers()

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-400">Error loading drivers: {error}</div>
      </div>
    )
  }

  const handleExport = () => {
    if (!drivers) return
    const exportData = drivers.map(({ id, company_id, created_at, updated_at, ...rest }) => rest)
    exportToExcel(exportData, "drivers")
  }

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="border-b border-border bg-card/30 backdrop-blur px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Drivers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your fleet drivers</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleExport}
            variant="outline"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground"
          >
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
          <Link href="/dashboard/drivers/add">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition">
              <Plus className="w-4 h-4 mr-2" />
              Add Driver
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {drivers && drivers.length > 0 ? (
            <div className="grid gap-4">
              {drivers.map((driver) => (
                <Card key={driver.id} className="border-border p-6 hover:border-primary/50 hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{driver.name}</h3>
                      <p className="text-sm text-muted-foreground">{driver.email}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        driver.status === "active" || driver.status === "on_route"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {driver.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <p className="text-foreground">Phone: {driver.phone}</p>
                    {driver.license_number && <p className="text-muted-foreground">License: {driver.license_number}</p>}
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-border/30">
                    <Link href={`/dashboard/drivers/${driver.id}`}>
                      <Button variant="outline" size="sm" className="flex-1 border-border/50 bg-transparent hover:bg-secondary/50">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    <Link href={`/dashboard/drivers/${driver.id}/edit`}>
                      <Button variant="outline" size="sm" className="border-border/50 bg-transparent hover:bg-secondary/50">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </Link>
                    <DeleteDriverButton driverId={driver.id} />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border p-12 text-center">
              <p className="text-muted-foreground mb-4">No drivers found.</p>
              <Link href="/dashboard/drivers/add">
                <Button>Add Your First Driver</Button>
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// OPTION 2: Client Component with useEffect
// ============================================
// File: app/dashboard/drivers/page-client.tsx

"use client"

import { useEffect, useState } from "react"
import { getDrivers } from "@/app/actions/drivers"
import { Button } from "@/components/ui/button"
// ... rest of imports

export default function DriversPageClient() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDrivers() {
      const { data, error } = await getDrivers()
      if (error) {
        setError(error)
      } else {
        setDrivers(data || [])
      }
      setLoading(false)
    }
    loadDrivers()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  // ... rest of component
}

