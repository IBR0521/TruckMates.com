"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  FileText, 
  Search,
  Calendar,
  Filter,
  Plus
} from "lucide-react"
import { getELDLogs } from "@/app/actions/eld"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { toast } from "sonner"
import Link from "next/link"
import { HOSCalculator } from "@/components/hos-calculator"
import { DriverScorecard } from "@/components/driver-scorecard"

export default function ELDLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({
    driver_id: "",
    truck_id: "",
    start_date: "",
    end_date: "",
    log_type: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadLogs()
  }, [filters])

  async function loadData() {
    try {
      const [driversResult, trucksResult] = await Promise.all([
        getDrivers(),
        getTrucks(),
      ])

      if (driversResult.data) setDrivers(driversResult.data)
      if (trucksResult.data) setTrucks(trucksResult.data)
    } catch (error) {
      toast.error("Failed to load data")
    }
  }

  async function loadLogs() {
    setIsLoading(true)
    try {
      const result = await getELDLogs({
        driver_id: filters.driver_id || undefined,
        truck_id: filters.truck_id || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        log_type: filters.log_type || undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setLogs(result.data)
      }
    } catch (error) {
      toast.error("Failed to load logs")
    } finally {
      setIsLoading(false)
    }
  }

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case "driving":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50"
      case "on_duty":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
      case "off_duty":
        return "bg-green-500/20 text-green-400 border-green-500/50"
      case "sleeper_berth":
        return "bg-purple-500/20 text-purple-400 border-purple-500/50"
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/50"
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ELD Log Entries</h1>
          <p className="text-sm text-muted-foreground mt-1">View Hours of Service (HOS) logs</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/eld/logs/add">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Log Entry
            </Button>
          </Link>
          <Link href="/dashboard/eld">
            <Button variant="outline">Back to ELD</Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Tools Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HOSCalculator />
            <DriverScorecard />
          </div>

          {/* Filters */}
          <Card className="p-4 bg-card/50 border-border">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Driver</label>
                <Select value={filters.driver_id || "all"} onValueChange={(value) => setFilters({ ...filters, driver_id: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Drivers" />
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
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Truck</label>
                <Select value={filters.truck_id || "all"} onValueChange={(value) => setFilters({ ...filters, truck_id: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Trucks" />
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
                <label className="text-xs text-muted-foreground mb-1 block">Log Type</label>
                <Select value={filters.log_type || "all"} onValueChange={(value) => setFilters({ ...filters, log_type: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="driving">Driving</SelectItem>
                    <SelectItem value="on_duty">On Duty</SelectItem>
                    <SelectItem value="off_duty">Off Duty</SelectItem>
                    <SelectItem value="sleeper_berth">Sleeper Berth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
            </div>
          </Card>

          {/* Logs List */}
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading logs...</p>
          ) : logs.length === 0 ? (
            <Card className="p-12 text-center bg-card/50 border-border">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No log entries found</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <Card key={log.id} className="p-4 bg-card/50 border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`px-3 py-1 rounded border ${getLogTypeColor(log.log_type)}`}>
                        <span className="text-xs font-medium">{log.log_type.replace("_", " ").toUpperCase()}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <p className="font-semibold text-foreground">
                            {log.drivers?.name || "Unknown Driver"}
                          </p>
                          {log.trucks && (
                            <p className="text-sm text-muted-foreground">
                              {log.trucks.truck_number}
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Start</p>
                            <p className="text-foreground">
                              {new Date(log.start_time).toLocaleString()}
                            </p>
                          </div>
                          {log.end_time && (
                            <div>
                              <p className="text-muted-foreground">End</p>
                              <p className="text-foreground">
                                {new Date(log.end_time).toLocaleString()}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground">Duration</p>
                            <p className="text-foreground">
                              {log.duration_minutes
                                ? `${Math.floor(log.duration_minutes / 60)}h ${log.duration_minutes % 60}m`
                                : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Miles</p>
                            <p className="text-foreground">{log.miles_driven || 0}</p>
                          </div>
                        </div>
                        {log.location_start && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Start: {log.location_start.address || `${log.location_start.lat}, ${log.location_start.lng}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.status === "certified" ? "bg-green-500/20 text-green-400" :
                        log.status === "uncertified" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-gray-500/20 text-gray-400"
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

