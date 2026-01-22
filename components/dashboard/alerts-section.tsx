"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Wrench, FileText, Package, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface AlertsSectionProps {
  upcomingMaintenance: Array<{
    id: string
    service_type: string
    scheduled_date: string
    status: string
  }>
  overdueInvoices: Array<{
    id: string
    invoice_number: string
    due_date: string
    amount: number
    status: string
  }>
  upcomingDeliveries: Array<{
    id: string
    shipment_number: string
    estimated_delivery: string
    status: string
  }>
}

export function AlertsSection({ upcomingMaintenance, overdueInvoices, upcomingDeliveries }: AlertsSectionProps) {
  const totalAlerts = upcomingMaintenance.length + overdueInvoices.length + upcomingDeliveries.length

  if (totalAlerts === 0) {
    return (
      <Card className="p-6 border-border bg-card/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Alerts & Reminders</h3>
          </div>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <p>No alerts at this time</p>
          <p className="text-sm mt-1">All systems running smoothly</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 border-border bg-card/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Alerts & Reminders</h3>
          <Badge variant="destructive" className="ml-2">{totalAlerts}</Badge>
        </div>
      </div>

      <div className="space-y-4">
        {/* Overdue Invoices */}
        {overdueInvoices.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-red-500" />
              <h4 className="text-sm font-semibold text-foreground">Overdue Invoices</h4>
            </div>
            <div className="space-y-2">
              {overdueInvoices.slice(0, 3).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-2 bg-red-500/10 rounded border border-red-500/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">{invoice.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {new Date(invoice.due_date).toLocaleDateString()} • ${Number(invoice.amount).toFixed(2)}
                    </p>
                  </div>
                  {invoice.id && typeof invoice.id === 'string' && invoice.id.trim() !== '' ? (
                    <Link href={`/dashboard/accounting/invoices/${invoice.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
            {overdueInvoices.length > 3 && (
              <Link href="/dashboard/accounting/invoices?status=overdue">
                <Button variant="ghost" size="sm" className="mt-2 w-full">
                  View All ({overdueInvoices.length})
                  <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Upcoming Maintenance */}
        {upcomingMaintenance.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-yellow-500" />
              <h4 className="text-sm font-semibold text-foreground">Upcoming Maintenance</h4>
            </div>
            <div className="space-y-2">
              {upcomingMaintenance.slice(0, 3).map((maint) => (
                <div key={maint.id} className="flex items-center justify-between p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">{maint.service_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(maint.scheduled_date).toLocaleDateString()}
                      {maint.status === "overdue" && (
                        <Badge variant="destructive" className="ml-2 text-xs">Overdue</Badge>
                      )}
                    </p>
                  </div>
                  <Link href="/dashboard/maintenance">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
            {upcomingMaintenance.length > 3 && (
              <Link href="/dashboard/maintenance">
                <Button variant="ghost" size="sm" className="mt-2 w-full">
                  View All ({upcomingMaintenance.length})
                  <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Upcoming Deliveries */}
        {upcomingDeliveries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-foreground">Upcoming Deliveries</h4>
            </div>
            <div className="space-y-2">
              {upcomingDeliveries.slice(0, 3).map((load) => (
                <div key={load.id} className="flex items-center justify-between p-2 bg-blue-500/10 rounded border border-blue-500/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">{load.shipment_number}</p>
                    <p className="text-xs text-muted-foreground">
                      ETA: {new Date(load.estimated_delivery).toLocaleDateString()}
                    </p>
                  </div>
                  {load.id && typeof load.id === 'string' && load.id.trim() !== '' ? (
                    <Link href={`/dashboard/loads/${load.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
            {upcomingDeliveries.length > 3 && (
              <Link href="/dashboard/loads?status=in_transit">
                <Button variant="ghost" size="sm" className="mt-2 w-full">
                  View All ({upcomingDeliveries.length})
                  <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}







