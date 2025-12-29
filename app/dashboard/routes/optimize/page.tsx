"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Route, Zap, TrendingUp, MapPin } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { optimizeMultiStopRoute, getRouteSuggestions } from "@/app/actions/route-optimization"
import { getRoutes } from "@/app/actions/routes"
import { getLoads } from "@/app/actions/loads"
import { Badge } from "@/components/ui/badge"

export default function RouteOptimizationPage() {
  const [routes, setRoutes] = useState<any[]>([])
  const [loads, setLoads] = useState<any[]>([])
  const [selectedRoute, setSelectedRoute] = useState<string>("")
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<any>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    const [routesResult, loadsResult] = await Promise.all([
      getRoutes(),
      getLoads(),
    ])

    if (routesResult.data) {
      setRoutes(routesResult.data)
    }
    if (loadsResult.data) {
      const pendingLoads = loadsResult.data.filter((l: any) => l.status === "pending")
      setLoads(pendingLoads)
    }
    setIsLoading(false)
  }

  async function handleOptimize() {
    if (!selectedRoute) {
      toast.error("Please select a route to optimize")
      return
    }

    setIsOptimizing(true)
    const result = await optimizeMultiStopRoute(selectedRoute)

    if (result.error) {
      toast.error(result.error)
      setIsOptimizing(false)
      return
    }

    if (result.optimized) {
      toast.success(`Route optimized! Saved ${result.distance ? Math.round(result.distance) : 0} miles`)
      setOptimizationResult(result)
      await loadData() // Reload routes to see updated order
    }

    setIsOptimizing(false)
  }

  async function handleGetSuggestions() {
    const pendingLoadIds = loads.filter((l) => l.status === "pending").map((l) => l.id)

    if (pendingLoadIds.length === 0) {
      toast.error("No pending loads to find route suggestions for")
      return
    }

    const result = await getRouteSuggestions(pendingLoadIds)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.suggestions.length === 0) {
      toast.info("No route suggestions found for pending loads")
      return
    }

    setSuggestions(result.suggestions)
    toast.success(`Found ${result.suggestions.length} route suggestion(s)`)
  }

  // Filter routes that have multiple stops (either via waypoints or route_stops table)
  const routesWithStops = routes.filter((r) => {
    const hasWaypoints = r.waypoints && Array.isArray(r.waypoints) && r.waypoints.length > 0
    // Also check if route has stops (would need to query route_stops table in production)
    return hasWaypoints
  })

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/routes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Route Optimization</h1>
            <p className="text-muted-foreground text-sm mt-1">Optimize multi-stop routes for efficiency</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Route Selection & Optimization */}
          <Card className="border-border p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Optimize Route</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select Route to Optimize
                </label>
                <select
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                >
                  <option value="">Choose a route with multiple stops...</option>
                  {routesWithStops.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name || `${route.origin} → ${route.destination}`} ({route.waypoints?.length || 0} stops)
                    </option>
                  ))}
                </select>
                {routesWithStops.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No routes with multiple stops found. Create a route with waypoints first.
                  </p>
                )}
              </div>

              {optimizationResult && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <h3 className="font-semibold text-foreground">Optimization Complete</h3>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Distance</p>
                      <p className="text-lg font-bold text-foreground">
                        {optimizationResult.distance?.toFixed(1) || "—"} miles
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Estimated Time</p>
                      <p className="text-lg font-bold text-foreground">
                        {optimizationResult.time ? `${Math.round(optimizationResult.time / 60)}h ${optimizationResult.time % 60}m` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Optimized Stops</p>
                      <p className="text-lg font-bold text-foreground">
                        {optimizationResult.optimizedStops?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleOptimize}
                disabled={!selectedRoute || isOptimizing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Zap className="w-4 h-4 mr-2" />
                {isOptimizing ? "Optimizing..." : "Optimize Route"}
              </Button>
            </div>
          </Card>

          {/* Route Suggestions */}
          <Card className="border-border p-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Route Suggestions</h2>
              </div>
              <Button
                onClick={handleGetSuggestions}
                variant="outline"
                size="sm"
              >
                Find Suggestions
              </Button>
            </div>

            {suggestions.length > 0 ? (
              <div className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="p-4 bg-secondary/30 rounded-lg border border-border"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">{suggestion.routeName}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>{suggestion.distance} miles</span>
                          <Badge variant={suggestion.efficiency >= 80 ? "default" : "secondary"}>
                            {suggestion.efficiency}% match
                          </Badge>
                        </div>
                      </div>
                      <Link href={`/dashboard/routes/${suggestion.routeId}`}>
                        <Button variant="outline" size="sm">
                          View Route
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Click "Find Suggestions" to see route recommendations based on your pending loads.
              </p>
            )}
          </Card>

          {/* Optimization Info */}
          <Card className="border-border p-4 md:p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">How Route Optimization Works</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">• Nearest Neighbor Algorithm</p>
                <p>Optimizes stop order to minimize total travel distance by selecting the nearest unvisited stop at each step.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">• Time Windows</p>
                <p>Considers delivery time windows and priority levels when optimizing route sequences.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">• Traffic-Aware Routing</p>
                <p className="text-xs text-muted-foreground mt-1">
                  For accurate distance and time calculations, integrate Google Maps Distance Matrix API or similar service.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

