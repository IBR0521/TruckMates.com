"use client"

import { MarketplaceComingSoon } from "@/components/marketplace-coming-soon"

export default function MarketplacePage() {
  return <MarketplaceComingSoon />
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"browse" | "my-loads">("browse")
  const [loads, setLoads] = useState<any[]>([])
  const [myLoads, setMyLoads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acceptingLoadId, setAcceptingLoadId] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === "browse") {
      loadMarketplaceLoads()
    } else {
      loadMyLoads()
    }
  }, [activeTab])

  const loadMarketplaceLoads = async () => {
    setLoading(true)
    try {
      const result = await getMarketplaceLoads({ limit: 50 })
      if (result.error) {
        toast.error(result.error)
      } else {
        setLoads(result.data || [])
      }
    } catch (error) {
      toast.error("Failed to load marketplace loads")
    } finally {
      setLoading(false)
    }
  }

  const loadMyLoads = async () => {
    setLoading(true)
    try {
      const result = await getBrokerMarketplaceLoads()
      if (result.error) {
        toast.error(result.error)
      } else {
        setMyLoads(result.data || [])
      }
    } catch (error) {
      toast.error("Failed to load your loads")
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptLoad = async (loadId: string) => {
    setAcceptingLoadId(loadId)
    try {
      const result = await acceptMarketplaceLoad(loadId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Load accepted! It's now in your loads dashboard.")
        router.push(`/dashboard/loads/${result.data?.createdLoad?.id}`)
      }
    } catch (error) {
      toast.error("Failed to accept load")
    } finally {
      setAcceptingLoadId(null)
      loadMarketplaceLoads()
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  return (
    <DetailPageLayout
      title="Load Marketplace"
      description="Browse and accept loads. Accepted loads automatically appear in your dashboard."
      actions={
        <>
          <Link href="/dashboard/marketplace/post">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Post Load
            </Button>
          </Link>
          <Link href="/dashboard/marketplace/settings">
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </Link>
        </>
      }
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "browse" | "my-loads")}>
        <TabsList>
          <TabsTrigger value="browse">Browse Loads</TabsTrigger>
          <TabsTrigger value="my-loads">My Posted Loads</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading loads...</p>
            </div>
          ) : loads.length === 0 ? (
            <Card className="p-12 text-center">
              <Truck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">No loads available</h3>
              <p className="text-muted-foreground">Check back later for new loads.</p>
            </Card>
          ) : (
            <div className="grid gap-6">
                {loads.map((load) => (
                  <Card key={load.id} className="p-6 hover:border-primary/50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        {load.id && typeof load.id === 'string' && load.id.trim() !== '' ? (
                          <Link href={`/dashboard/marketplace/${load.id}`}>
                            <div className="flex items-center gap-3 mb-3">
                              <Badge variant="outline">{load.equipment_type || "Any Equipment"}</Badge>
                              <Badge variant="secondary">{formatCurrency(load.rate)}</Badge>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                              <MapPin className="w-4 h-4" />
                              <span className="font-medium">{load.origin}</span>
                              <span>→</span>
                              <span className="font-medium">{load.destination}</span>
                            </div>
                          </Link>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 mb-3">
                              <Badge variant="outline">{load.equipment_type || "Any Equipment"}</Badge>
                              <Badge variant="secondary">{formatCurrency(load.rate)}</Badge>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                              <MapPin className="w-4 h-4" />
                              <span className="font-medium">{load.origin}</span>
                              <span>→</span>
                              <span className="font-medium">{load.destination}</span>
                            </div>
                          </>
                        )}
                        {load.weight && (
                          <p className="text-sm text-muted-foreground mb-1">Weight: {load.weight}</p>
                        )}
                        {load.contents && (
                          <p className="text-sm text-muted-foreground mb-1">Contents: {load.contents}</p>
                        )}
                        {load.pickup_date && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>Pickup: {format(new Date(load.pickup_date), "MMM d, yyyy")}</span>
                          </div>
                        )}
                        {load.notes && (
                          <p className="text-sm text-muted-foreground mt-2">{load.notes}</p>
                        )}
                      </div>
                    <div className="flex flex-col gap-2 md:items-end">
                      <div className="text-right mb-2">
                        <div className="text-2xl font-bold text-primary">
                          {formatCurrency(load.rate)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {load.rate_type === "per_mile" ? "per mile" : "flat rate"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {load.id && typeof load.id === 'string' && load.id.trim() !== '' ? (
                          <Link href={`/dashboard/marketplace/${load.id}`}>
                            <Button variant="outline" className="w-full md:w-auto">
                              View Details
                            </Button>
                          </Link>
                        ) : null}
                        <Button
                          onClick={() => handleAcceptLoad(load.id)}
                          disabled={acceptingLoadId === load.id}
                          className="w-full md:w-auto"
                        >
                          <Truck className="w-4 h-4 mr-2" />
                          {acceptingLoadId === load.id ? "Accepting..." : "Accept Load"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-loads" className="mt-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading your loads...</p>
            </div>
          ) : myLoads.length === 0 ? (
            <Card className="p-12 text-center">
              <Truck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">No loads posted yet</h3>
              <p className="text-muted-foreground mb-6">Post your first load to get started.</p>
              <Link href="/dashboard/marketplace/post">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Post Load
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid gap-6">
              {myLoads.map((load) => (
                <Card key={load.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge
                          variant={
                            load.status === "accepted"
                              ? "default"
                              : load.status === "matched"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {load.status}
                        </Badge>
                        <Badge variant="outline">{load.equipment_type || "Any Equipment"}</Badge>
                        <Badge variant="secondary">{formatCurrency(load.rate)}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <MapPin className="w-4 h-4" />
                        <span className="font-medium">{load.origin}</span>
                        <span>→</span>
                        <span className="font-medium">{load.destination}</span>
                      </div>
                      {load.created_load && (
                        <p className="text-sm text-muted-foreground mb-1">
                          Accepted by carrier - Load: {load.created_load.shipment_number}
                        </p>
                      )}
                      {load.matched_at && (
                        <p className="text-sm text-muted-foreground">
                          Matched: {format(new Date(load.matched_at), "MMM d, yyyy h:mm a")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {load.created_load?.id && typeof load.created_load.id === 'string' ? (
                        <Link href={`/dashboard/loads/${load.created_load.id}`}>
                          <Button variant="outline" className="w-full md:w-auto">
                            View Load
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DetailPageLayout>
  )
}

