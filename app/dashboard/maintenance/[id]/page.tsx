"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"

export default function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/maintenance/add")
    }
  }, [id, router])

  if (id === "add") {
    return null
  }

  const maintenance = {
    id: id,
    truck: "TR-001",
    type: "Oil Change",
    scheduledDate: "01/15/2025",
    completedDate: null,
    mileage: "95,000 mi",
    status: "Scheduled",
    priority: "Normal",
    estimatedCost: "$180",
    actualCost: null,
    vendor: "Quick Lube Service Center",
    technician: "Mike Roberts",
    notes: "Regular scheduled maintenance",
    nextServiceDue: "98,000 mi",
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/maintenance">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Maintenance
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Maintenance Details</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {maintenance.truck} - {maintenance.type}
            </p>
          </div>
          {maintenance.status === "Scheduled" && (
            <Button
              onClick={() => {
                toast.success("Maintenance marked as completed")
                // In a real app, this would update the status in the database
              }}
              className="bg-green-500 hover:bg-green-600"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark Completed
            </Button>
          )}
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-border p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Truck</p>
                  <p className="text-lg font-semibold text-foreground">{maintenance.truck}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Service Type</p>
                  <p className="text-foreground font-medium">{maintenance.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Scheduled Date</p>
                  <p className="text-foreground">{maintenance.scheduledDate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Mileage</p>
                  <p className="text-foreground">{maintenance.mileage}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Next Service Due</p>
                  <p className="text-foreground">{maintenance.nextServiceDue}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-500/20 text-blue-400">
                    {maintenance.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Priority</p>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      maintenance.priority === "High" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {maintenance.priority}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estimated Cost</p>
                  <p className="text-lg font-semibold text-foreground">{maintenance.estimatedCost}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Service Vendor</p>
                  <p className="text-foreground">{maintenance.vendor}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Technician</p>
                  <p className="text-foreground">{maintenance.technician}</p>
                </div>
              </div>
            </div>

            {maintenance.notes && (
              <div className="border-t border-border pt-6 mt-6">
                <p className="text-sm text-muted-foreground mb-2">Notes</p>
                <p className="text-foreground">{maintenance.notes}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
