"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FeatureLock } from "@/components/billing/feature-lock"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getPermits } from "@/app/actions/permits"
import { toast } from "sonner"

type PermitRow = {
  id: string
  permit_number?: string | null
  issuing_state?: string | null
  permit_type?: string | null
  expiry_date?: string | null
  load_id?: string | null
  truck_id?: string | null
}

export default function PermitsPageClient() {
  const [permits, setPermits] = useState<PermitRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const result = await getPermits()
      if (result.error) {
        toast.error(result.error)
        setPermits([])
      } else {
        setPermits((result.data as PermitRow[]) || [])
      }
      setLoading(false)
    })()
  }, [])

  return (
    <FeatureLock
      featureKey="permit_management"
      title="Permit management"
      description="Centralize oversized and trip permits with renewals, attachments, and load linkage so roadside exposure drops."
    >
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Permits</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Company permits across loads and trucks. Attach documents from each load&apos;s detail page.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard/loads">Go to loads</Link>
          </Button>
        </div>

        <Card className="border-border overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading permits…</p>
          ) : permits.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No permits yet. Create permits from a load detail page when a shipment requires oversize/overweight
              authority.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="p-3 font-medium">Permit #</th>
                    <th className="p-3 font-medium">State</th>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium">Expires</th>
                    <th className="p-3 font-medium">Load</th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((permit) => (
                    <tr key={permit.id} className="border-b border-border/60">
                      <td className="p-3">{permit.permit_number || "—"}</td>
                      <td className="p-3">{permit.issuing_state || "—"}</td>
                      <td className="p-3 capitalize">{permit.permit_type || "—"}</td>
                      <td className="p-3">
                        {permit.expiry_date
                          ? new Date(permit.expiry_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="p-3">
                        {permit.load_id ? (
                          <Link
                            href={`/dashboard/loads/${permit.load_id}`}
                            className="text-primary hover:underline"
                          >
                            View load
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </FeatureLock>
  )
}
