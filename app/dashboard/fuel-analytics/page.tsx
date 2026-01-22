"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Fuel, TrendingUp, TrendingDown, DollarSign, Gauge, BarChart3 } from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getFuelAnalytics, getFuelCostPerRoute } from "@/app/actions/fuel-analytics"
import { getTrucks } from "@/app/actions/trucks"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function FuelAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [routeCosts, setRouteCosts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [trucks, setTrucks] = useState<any[]>([])
  const [filters, setFilters] = useState({
    truck_id: "all",
    start_date: "",
    end_date: "",
  })

  useEffect(() => {
    loadTrucks()
  }, [])

  useEffect(() => {
    loadAnalytics()
  }, [filters])

  const loadTrucks = async () => {
    const result = await getTrucks()
    if (result.data) {
      setTrucks(result.data)
    }
  }

  const loadAnalytics = async () => {
    setIsLoading(true)
    try {
      const analyticsFilters: any = {}
      if (filters.truck_id !== "all") {
        analyticsFilters.truck_id = filters.truck_id
      }
      if (filters.start_date) {
        analyticsFilters.start_date = filters.start_date
      }
      if (filters.end_date) {
        analyticsFilters.end_date = filters.end_date
      }

      const [analyticsResult, routeCostsResult] = await Promise.all([
        getFuelAnalytics(analyticsFilters),
        getFuelCostPerRoute(analyticsFilters),
      ])

      if (analyticsResult.error) {
        toast.error(analyticsResult.error)
      } else if (analyticsResult.data) {
        setAnalytics(analyticsResult.data)
      }

      if (routeCostsResult.error) {
        toast.error(routeCostsResult.error)
      } else if (routeCostsResult.data) {
        setRouteCosts(routeCostsResult.data.route_fuel_costs || [])
      }
    } catch (error: any) {
      toast.error("Failed to load fuel analytics")
    } finally {
      setIsLoading(false)
    }
  }

  const truckAnalytics = analytics?.truck_analytics ? Object.values(analytics.truck_analytics) : []

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fuel Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Track fuel consumption, MPG, and costs</p>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Truck</Label>
                <Select value={filters.truck_id} onValueChange={(value) => setFilters({ ...filters, truck_id: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Trucks</SelectItem>
                    {trucks.map((truck) => (
                      <SelectItem key={truck.id} value={truck.id}>
                        {truck.truck_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => setFilters({ truck_id: "all", start_date: "", end_date: "" })}
                  variant="outline"
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </Card>

          {/* Summary Cards */}
          {analytics && analytics.summary && (
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="border border-border/50 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <p className="text-muted-foreground text-sm font-medium">Total Fuel Cost</p>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  ${analytics.summary.total_fuel_cost.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.summary.total_fuel_expenses} fuel expense{analytics.summary.total_fuel_expenses !== 1 ? "s" : ""}
                </p>
              </Card>
              <Card className="border border-border/50 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Gauge className="w-5 h-5 text-primary" />
                  <p className="text-muted-foreground text-sm font-medium">Fleet Avg MPG</p>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {analytics.summary.fleet_avg_mpg ? `${analytics.summary.fleet_avg_mpg} MPG` : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {truckAnalytics.length} truck{truckAnalytics.length !== 1 ? "s" : ""} tracked
                </p>
              </Card>
              <Card className="border border-border/50 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <p className="text-muted-foreground text-sm font-medium">Cost Per Mile</p>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {analytics.summary.fleet_avg_cost_per_mile ? `$${analytics.summary.fleet_avg_cost_per_mile}` : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.summary.fleet_total_miles ? analytics.summary.fleet_total_miles.toLocaleString() : "0"} total miles
                </p>
              </Card>
              <Card className="border border-border/50 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <p className="text-muted-foreground text-sm font-medium">Trucks Tracked</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{truckAnalytics.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  With fuel data
                </p>
              </Card>
            </div>
          )}

          {/* Truck Analytics Table */}
          {isLoading ? (
            <Card className="p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading fuel analytics...</p>
              </div>
            </Card>
          ) : truckAnalytics.length === 0 ? (
            <Card className="p-8">
              <div className="text-center py-12">
                <Fuel className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Fuel Data</h3>
                <p className="text-muted-foreground">
                  Add fuel expenses to see analytics and MPG calculations
                </p>
              </div>
            </Card>
          ) : (
            <>
              <Card className="border border-border/50 overflow-hidden">
                <div className="p-6 border-b border-border">
                  <h2 className="text-lg font-semibold text-foreground">Truck Fuel Performance</h2>
                  <p className="text-sm text-muted-foreground mt-1">MPG and cost analysis by truck</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Truck</TableHead>
                        <TableHead>Total Fuel Cost</TableHead>
                        <TableHead>Fuel Expenses</TableHead>
                        <TableHead>Total Miles</TableHead>
                        <TableHead>Avg MPG</TableHead>
                        <TableHead>Cost Per Mile</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {truckAnalytics.map((truck: any) => (
                        <TableRow key={truck.truck_id}>
                          <TableCell className="font-medium">{truck.truck_number}</TableCell>
                          <TableCell>${truck.total_fuel_cost.toFixed(2)}</TableCell>
                          <TableCell>{truck.total_fuel_expenses}</TableCell>
                          <TableCell>{truck.total_miles ? truck.total_miles.toLocaleString() : "0"}</TableCell>
                          <TableCell>
                            {truck.avg_mpg ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                {truck.avg_mpg} MPG
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {truck.avg_cost_per_mile ? (
                              `$${truck.avg_cost_per_mile}`
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Route Fuel Costs */}
              {routeCosts.length > 0 && (
                <Card className="border border-border/50 overflow-hidden">
                  <div className="p-6 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">Fuel Cost Per Route</h2>
                    <p className="text-sm text-muted-foreground mt-1">Fuel expenses by route</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead>Origin → Destination</TableHead>
                          <TableHead>Fuel Expenses</TableHead>
                          <TableHead>Total Fuel Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {routeCosts.map((route: any) => (
                          <TableRow key={route.route_id}>
                            <TableCell className="font-medium">{route.route_number || "N/A"}</TableCell>
                            <TableCell>
                              {route.origin || "N/A"} → {route.destination || "N/A"}
                            </TableCell>
                            <TableCell>{route.fuel_expenses_count}</TableCell>
                            <TableCell className="font-semibold">${route.total_fuel_cost.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}

              {/* Monthly Trends */}
              {analytics?.trends && analytics.trends.length > 0 && (
                <Card className="border border-border/50 p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Monthly Fuel Trends</h2>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead>Fuel Cost</TableHead>
                          <TableHead>Fuel Expenses</TableHead>
                          <TableHead>Miles</TableHead>
                          <TableHead>Avg Cost/Mile</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.trends.map((trend: any) => (
                          <TableRow key={trend.month}>
                            <TableCell className="font-medium">
                              {new Date(trend.month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                            </TableCell>
                            <TableCell>${trend.cost.toFixed(2)}</TableCell>
                            <TableCell>{trend.expenses}</TableCell>
                            <TableCell>{trend.miles ? trend.miles.toLocaleString() : "0"}</TableCell>
                            <TableCell>
                              {trend.avg_cost_per_mile ? (
                                `$${trend.avg_cost_per_mile}`
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

