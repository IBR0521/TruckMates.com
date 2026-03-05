"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MapPin, Calendar, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { getMarketplaceLoad, acceptMarketplaceLoad } from "@/app/actions/marketplace"

export default function MarketplaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [load, setLoad] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setIsLoading(true)
    try {
      const result = await getMarketplaceLoad(id)
      if (result.error) {
        toast.error(result.error)
        router.push("/dashboard/marketplace")
      } else {
        setLoad(result.data)
      }
    } catch (error: any) {
      toast.error("Failed to load load details")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAccept() {
    setIsAccepting(true)
    try {
      const result = await acceptMarketplaceLoad(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Load accepted! Redirecting to load details...")
        router.push(`/dashboard/loads/${result.data?.createdLoad?.id}`)
      }
    } catch (error: any) {
      toast.error("Failed to accept load")
    } finally {
      setIsAccepting(false)
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="w-full bg-background">
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Loading load details...</p>
        </div>
      </div>
    )
  }

  if (!load) {
    return (
      <div className="w-full bg-background">
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Load not found</p>
          <Link href="/dashboard/marketplace">
            <Button variant="outline" className="mt-4">
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/marketplace">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Load Details</h1>
            <p className="text-muted-foreground mt-2">Marketplace load information</p>
          </div>
          {load.status === "available" && (
            <Button onClick={handleAccept} disabled={isAccepting}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isAccepting ? "Accepting..." : "Accept Load"}
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Badge variant={load.status === "available" ? "default" : "secondary"}>
                {load.status}
              </Badge>
              <Badge variant="outline">{load.equipment_type || "Any Equipment"}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Origin</h3>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">{load.origin}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Destination</h3>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">{load.destination}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Rate</h3>
                <p className="text-3xl font-bold text-primary">{formatCurrency(load.rate)}</p>
                <p className="text-sm text-muted-foreground">
                  {load.rate_type === "per_mile" ? "per mile" : "flat rate"}
                </p>
              </div>

              {load.broker && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Broker</h3>
                  <p className="font-medium">{load.broker.name}</p>
                </div>
              )}

              {load.pickup_date && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Pickup Date</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <p>{format(new Date(load.pickup_date), "MMM d, yyyy")}</p>
                  </div>
                </div>
              )}

              {load.delivery_date && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Delivery Date</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <p>{format(new Date(load.delivery_date), "MMM d, yyyy")}</p>
                  </div>
                </div>
              )}

              {load.weight && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Weight</h3>
                  <p>{load.weight}</p>
                </div>
              )}

              {load.contents && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Contents</h3>
                  <p>{load.contents}</p>
                </div>
              )}
            </div>

            {load.notes && (
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
                <p className="text-sm">{load.notes}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
