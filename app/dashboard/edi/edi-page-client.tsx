"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getEdiTenders } from "@/app/actions/edi-tenders"
import { toast } from "sonner"

type EdiTender = {
  id: string
  tender_number?: string | null
  shipment_reference?: string | null
  status?: string | null
  shipper_name?: string | null
  consignee_name?: string | null
  pickup_date?: string | null
  delivery_date?: string | null
}

export function EdiPageClient() {
  const [tenders, setTenders] = useState<EdiTender[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const result = await getEdiTenders()
      if (result.error) toast.error(result.error)
      else setTenders((result.data || []) as EdiTender[])
      setLoading(false)
    })()
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">EDI tender inbox</h1>
      <p className="text-sm text-muted-foreground">Inbound load tenders received via EDI integration.</p>
      <Card className="p-4 border-border">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tenders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tenders yet. Configure EDI in Settings → Integration.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {tenders.map((t) => (
              <li key={t.id} className="py-3 flex justify-between gap-2">
                <div>
                  <p className="font-medium">{t.tender_number || t.shipment_reference || t.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.shipper_name} → {t.consignee_name} · Pickup {t.pickup_date || "—"}
                  </p>
                </div>
                <Badge variant="secondary">{t.status || "pending"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
