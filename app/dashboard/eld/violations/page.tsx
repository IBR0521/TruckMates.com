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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { 
  AlertTriangle, 
  Search,
  CheckCircle2,
  XCircle,
  Plus
} from "lucide-react"
import { getELDEvents, resolveELDEvent } from "@/app/actions/eld"
import { getDrivers } from "@/app/actions/drivers"
import { toast } from "sonner"
import Link from "next/link"

export default function ELDViolationsPage() {
  const [violations, setViolations] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showResolveDialog, setShowResolveDialog] = useState(false)
  const [selectedViolation, setSelectedViolation] = useState<any>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [filters, setFilters] = useState({
    driver_id: "",
    status: "open",
    severity: "",
    start_date: "",
    end_date: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadViolations()
  }, [filters])

  async function loadData() {
    try {
      const driversResult = await getDrivers()
      if (driversResult.data) setDrivers(driversResult.data)
    } catch (error) {
      toast.error("Failed to load data")
    }
  }

  async function loadViolations() {
    setIsLoading(true)
    try {
      const result = await getELDEvents({
        event_type: "hos_violation",
        driver_id: filters.driver_id || undefined,
        severity: filters.severity || undefined,
        resolved: filters.status === "resolved" ? true : filters.status === "unresolved" ? false : undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setViolations(result.data)
      }
    } catch (error) {
      toast.error("Failed to load violations")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResolveViolation() {
    if (!selectedViolation) return
    try {
      const result = await resolveELDEvent(selectedViolation.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Violation resolved successfully")
        setShowResolveDialog(false)
        setSelectedViolation(null)
        setResolutionNotes("")
        loadViolations()
      }
    } catch (error) {
      toast.error("Failed to resolve violation")
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/50"
      case "serious":
        return "bg-orange-500/20 text-orange-400 border-orange-500/50"
      case "minor":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/50"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-500/20 text-red-400"
      case "acknowledged":
        return "bg-yellow-500/20 text-yellow-400"
      case "resolved":
        return "bg-green-500/20 text-green-400"
      default:
        return "bg-gray-500/20 text-gray-400"
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ELD Violations</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage HOS violations</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/eld/violations/add">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Event/Violation
            </Button>
          </Link>
          <Link href="/dashboard/eld">
            <Button variant="outline">Back to ELD</Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
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
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={filters.status || "all"} onValueChange={(value) => setFilters({ ...filters, status: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
                <Select value={filters.severity || "all"} onValueChange={(value) => setFilters({ ...filters, severity: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="serious">Serious</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
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

          {/* Violations List */}
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading violations...</p>
          ) : violations.length === 0 ? (
            <Card className="p-12 text-center bg-card/50 border-border">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-muted-foreground">No violations found</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {violations.map((violation) => (
                <Card key={violation.id} className={`p-4 border ${getSeverityColor(violation.severity)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-5 h-5" />
                        <h3 className="font-semibold text-foreground">
                          {violation.violation_type.replace("_", " ")}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                          {violation.severity}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(violation.status)}`}>
                          {violation.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{violation.description}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{violation.drivers?.name || "Unknown Driver"}</span>
                        <span>•</span>
                        <span>{new Date(violation.violation_date).toLocaleDateString()}</span>
                        {violation.violation_code && (
                          <>
                            <span>•</span>
                            <span>Code: {violation.violation_code}</span>
                          </>
                        )}
                      </div>
                      {violation.resolution_notes && (
                        <div className="mt-2 p-2 bg-background/50 rounded text-sm">
                          <p className="font-medium">Resolution Notes:</p>
                          <p className="text-muted-foreground">{violation.resolution_notes}</p>
                        </div>
                      )}
                    </div>
                    {violation.status === "open" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedViolation(violation)
                          setShowResolveDialog(true)
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Resolve Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Violation</DialogTitle>
            <DialogDescription>
              Add resolution notes for this violation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Resolution Notes</Label>
              <Textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Enter resolution details..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolveViolation}>
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

