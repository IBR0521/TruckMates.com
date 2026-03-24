"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Fuel, TrendingUp, Gauge, DollarSign, Truck, User } from "lucide-react"
import { getFuelEfficiencyReport } from "@/app/actions/fuel-analytics"
import { getTrucks } from "@/app/actions/trucks"
import { getDrivers } from "@/app/actions/drivers"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export default function FuelEfficiencyReportPage() {
  const [report, setReport] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [trucks, setTrucks] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    truck_id: "all",
    driver_id: "all",
  })

  useEffect(() => {
    loadTrucks()
    loadDrivers()
  }, [])

  useEffect(() => {
    loadReport()
  }, [filters])

  async function loadTrucks() {
    const result = await getTrucks()
    if (result.data) {
      setTrucks(result.data)
    }
  }

  async function loadDrivers() {
    const result = await getDrivers()
    if (result.data) {
      setDrivers(result.data)
    }
  }

  async function loadReport() {
    setIsLoading(true)
    try {
      const reportFilters: any = {}
      if (filters.start_date) reportFilters.start_date = filters.start_date
      if (filters.end_date) reportFilters.end_date = filters.end_date
      if (filters.truck_id !== "all") reportFilters.truck_id = filters.truck_id
      if (filters.driver_id !== "all") reportFilters.driver_id = filters.driver_id

      const result = await getFuelEfficiencyReport(reportFilters)

      if (result.error) {
        toast.error(result.error)
        setReport(null)
      } else {
        setReport(result.data)
      }
    } catch (error: unknown) {
      toast.error("Failed to load fuel efficiency report")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  return (
    <div className="w-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fuel Efficiency Report</h1>
            <p className="text-muted-foreground mt-2">
              MPG by truck and driver, fuel cost per mile analysis
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Truck</Label>
                <Select
                  value={filters.truck_id}
                  onValueChange={(value) => setFilters({ ...filters, truck_id: value })}
                >
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
                <Label>Driver</Label>
                <Select
                  value={filters.driver_id}
                  onValueChange={(value) => setFilters({ ...filters, driver_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() =>
                    setFilters({ start_date: "", end_date: "", truck_id: "all", driver_id: "all" })
                  }
                  variant="outline"
                  className="w-full"
                >
                  Clear
                </Button>
              </div>
            </div>
          </Card>

          {/* Summary Cards */}
          {report?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Fleet Avg MPG</p>
                  <Gauge className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {report.summary.fleet_avg_mpg ? `${report.summary.fleet_avg_mpg} MPG` : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {report.by_truck?.length || 0} trucks tracked
                </p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Cost Per Mile</p>
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {report.summary.fleet_avg_cost_per_mile
                    ? formatCurrency(report.summary.fleet_avg_cost_per_mile)
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {report.summary.fleet_total_miles?.toLocaleString() || 0} total miles
                </p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Total Fuel Cost</p>
                  <Fuel className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(report.summary.fleet_total_cost)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {report.summary.fleet_total_gallons?.toFixed(1) || 0} gallons
                </p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Total Miles</p>
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {report.summary.fleet_total_miles?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  In this period
                </p>
              </Card>
            </div>
          )}

          {/* Efficiency Tables */}
          <Tabs defaultValue="trucks" className="w-full">
            <TabsList>
              <TabsTrigger value="trucks">
                <Truck className="w-4 h-4 mr-2" />
                By Truck
              </TabsTrigger>
              <TabsTrigger value="drivers">
                <User className="w-4 h-4 mr-2" />
                By Driver
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trucks">
              <Card className="p-6">
                <h2 className="text-2xl font-bold text-foreground mb-6">Fuel Efficiency by Truck</h2>
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading truck efficiency data...</p>
                  </div>
                ) : !report?.by_truck || report.by_truck.length === 0 ? (
                  <div className="text-center py-12">
                    <Fuel className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No fuel efficiency data available for trucks.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Truck</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                          <TableHead className="text-right">Total Miles</TableHead>
                          <TableHead className="text-right">Total Gallons</TableHead>
                          <TableHead className="text-right">Avg MPG</TableHead>
                          <TableHead className="text-right">Cost Per Mile</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.by_truck.map((truck: any, index: number) => (
                          <TableRow key={truck.truck_id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-muted-foreground" />
                                {truck.truck_number}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(truck.total_cost)}
                            </TableCell>
                            <TableCell className="text-right">
                              {truck.total_miles.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {truck.total_gallons.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={index === 0 ? "default" : "outline"}
                                className={
                                  index === 0
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : ""
                                }
                              >
                                {truck.avg_mpg} MPG
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {truck.avg_cost_per_mile
                                ? formatCurrency(truck.avg_cost_per_mile)
                                : "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="drivers">
              <Card className="p-6">
                <h2 className="text-2xl font-bold text-foreground mb-6">Fuel Efficiency by Driver</h2>
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading driver efficiency data...</p>
                  </div>
                ) : !report?.by_driver || report.by_driver.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No fuel efficiency data available for drivers.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                          <TableHead className="text-right">Total Miles</TableHead>
                          <TableHead className="text-right">Total Gallons</TableHead>
                          <TableHead className="text-right">Avg MPG</TableHead>
                          <TableHead className="text-right">Cost Per Mile</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.by_driver.map((driver: any, index: number) => (
                          <TableRow key={driver.driver_id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                {driver.driver_name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(driver.total_cost)}
                            </TableCell>
                            <TableCell className="text-right">
                              {driver.total_miles.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {driver.total_gallons.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={index === 0 ? "default" : "outline"}
                                className={
                                  index === 0
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : ""
                                }
                              >
                                {driver.avg_mpg} MPG
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {driver.avg_cost_per_mile
                                ? formatCurrency(driver.avg_cost_per_mile)
                                : "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

