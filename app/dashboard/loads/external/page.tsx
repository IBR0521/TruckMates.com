"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  ArrowLeft, 
  RefreshCw, 
  Download, 
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  DollarSign,
  Truck
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { 
  getExternalLoads, 
  importExternalLoad, 
  syncExternalBrokerLoads,
  getExternalBrokerIntegrations 
} from "@/app/actions/external-broker-integrations"

export default function ExternalLoadsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState<string | null>(null)
  const [externalLoads, setExternalLoads] = useState<any[]>([])
  const [integrations, setIntegrations] = useState<any[]>([])
  const [selectedIntegration, setSelectedIntegration] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("available")

  useEffect(() => {
    loadData()
  }, [selectedIntegration, statusFilter])

  async function loadData() {
    setIsLoading(true)
    try {
      const [loadsResult, integrationsResult] = await Promise.all([
        getExternalLoads({
          integration_id: selectedIntegration !== "all" ? selectedIntegration : undefined,
          status: statusFilter,
          limit: 50,
        }),
        getExternalBrokerIntegrations(),
      ])

      if (loadsResult.error) {
        toast.error(loadsResult.error)
      } else {
        setExternalLoads(loadsResult.data || [])
      }

      if (integrationsResult.error) {
        toast.error(integrationsResult.error)
      } else {
        setIntegrations(integrationsResult.data || [])
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSync(integrationId: string) {
    setIsSyncing(integrationId)
    try {
      const result = await syncExternalBrokerLoads(integrationId, "manual")
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Sync started successfully")
        setTimeout(() => loadData(), 2000) // Reload after 2 seconds
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to sync")
    } finally {
      setIsSyncing(null)
    }
  }

  async function handleImport(loadId: string) {
    try {
      const result = await importExternalLoad(loadId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Load imported successfully")
        loadData()
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to import load")
    }
  }

  const getProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      dat: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      truckstop: "bg-green-500/10 text-green-600 border-green-500/20",
      "123loadboard": "bg-purple-500/10 text-purple-600 border-purple-500/20",
    }
    return colors[provider] || "bg-gray-500/10 text-gray-600 border-gray-500/20"
  }

  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href="/dashboard/loads" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Loads
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <ExternalLink className="w-6 h-6" />
            External Loads
          </h1>
          <p className="text-muted-foreground mt-2">
            Find loads from DAT, Truckstop, and other load boards. Import them directly into your system.
          </p>
        </div>

        {/* How It Works - Simple Explanation */}
        <Card className="p-6 bg-primary/5 border-primary/20">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            How It Works
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-primary">1</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Connect to Load Boards</p>
                <p>Link your DAT, Truckstop, or 123Loadboard account in Settings → Integration</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-primary">2</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Sync Loads</p>
                <p>Click "Sync Now" to get available loads from the connected load boards</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-primary">3</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Import Loads</p>
                <p>Click "Import Load" on any load you want to add to your system</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Setup Status */}
        {integrations.length === 0 ? (
          <Card className="p-6 text-center border-dashed">
            <ExternalLink className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold mb-2">No Load Boards Connected</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Connect to DAT, Truckstop, or 123Loadboard to automatically find and import loads into your system.
            </p>
            <Link href="/dashboard/settings/integration">
              <Button>
                <ExternalLink className="w-4 h-4 mr-2" />
                Connect Load Board
              </Button>
            </Link>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Connected Load Boards</h2>
              <Link href="/dashboard/settings/integration">
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {integrations.map((integration) => (
                <div key={integration.id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={getProviderBadge(integration.provider)}>
                      {integration.provider.toUpperCase()}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      {integration.dat_last_sync_at || integration.truckstop_last_sync_at || integration.loadboard123_last_sync_at 
                        ? `Last synced: ${new Date(integration.dat_last_sync_at || integration.truckstop_last_sync_at || integration.loadboard123_last_sync_at).toLocaleString()}`
                        : "Never synced"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSync(integration.id)}
                    disabled={isSyncing === integration.id}
                  >
                    {isSyncing === integration.id ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Get Loads
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Filters - Only show if we have loads */}
        {integrations.length > 0 && externalLoads.length > 0 && (
          <Card className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label>Filter by Board</Label>
                <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Boards</SelectItem>
                    {integrations.map((integration) => (
                      <SelectItem key={integration.id} value={integration.id}>
                        {integration.provider.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label>Show</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available Only</SelectItem>
                    <SelectItem value="all">All Loads</SelectItem>
                    <SelectItem value="imported">Already Imported</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        )}

        {/* Loads List */}
        {isLoading ? (
          <Card className="p-6 text-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-spin" />
            <p className="text-muted-foreground">Loading loads...</p>
          </Card>
        ) : externalLoads.length === 0 ? (
          <Card className="p-6 text-center border-dashed">
            <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold mb-2">No Loads Found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {integrations.length === 0 
                ? "Connect a load board first, then click 'Get Loads' to find available loads."
                : "Click 'Get Loads' on a connected board above to find available loads."}
            </p>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Available Loads ({externalLoads.length})
              </h2>
            </div>
            <div className="grid gap-4">
              {externalLoads.map((load) => (
                <Card key={load.id} className="p-6 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className={getProviderBadge(load.external_board)}>
                          {load.external_board.toUpperCase()}
                        </Badge>
                        {load.broker_rating && (
                          <div className="flex items-center gap-1 text-sm">
                            <span>⭐</span>
                            <span className="font-medium">{load.broker_rating}/5</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mb-3">
                        <div className="flex items-center gap-2 text-lg font-semibold text-foreground mb-1">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span>{load.origin}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{load.destination}</span>
                        </div>
                        {load.distance_miles && (
                          <p className="text-sm text-muted-foreground ml-6">
                            {load.distance_miles} miles
                          </p>
                        )}
                      </div>

                      {load.broker_name && (
                        <p className="text-sm text-muted-foreground mb-1">
                          <span className="font-medium">Broker:</span> {load.broker_name}
                          {load.broker_days_to_pay && (
                            <span className="ml-2">• Pays in {load.broker_days_to_pay} days</span>
                          )}
                        </p>
                      )}
                      
                      {load.pickup_date && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Pickup:</span> {new Date(load.pickup_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="text-right ml-4">
                      {load.rate && (
                        <div className="text-3xl font-bold text-primary mb-2">
                          ${load.rate.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-4 border-t">
                    {load.status === "available" ? (
                      <Button
                        onClick={() => handleImport(load.id)}
                        className="flex-1"
                      >
                        Import to My Loads
                      </Button>
                    ) : (
                      <Badge variant="outline" className="flex-1 justify-center">
                        {load.status === "imported" ? "Already Imported" : load.status}
                      </Badge>
                    )}
                    {load.external_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a href={load.external_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Details
                        </a>
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

