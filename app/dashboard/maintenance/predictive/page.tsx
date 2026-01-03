"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Calendar, DollarSign, TrendingUp, Wrench } from "lucide-react"
import { toast } from "sonner"
import { predictMaintenanceNeeds, createMaintenanceFromPrediction } from "@/app/actions/maintenance-predictive"

export default function PredictiveMaintenancePage() {
  const [predictions, setPredictions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [schedulingId, setSchedulingId] = useState<string | null>(null)

  useEffect(() => {
    loadPredictions()
  }, [])

  const loadPredictions = async () => {
    setIsLoading(true)
    try {
      const result = await predictMaintenanceNeeds()
      if (result.error) {
        toast.error(result.error)
        setPredictions([])
      } else {
        setPredictions(result.data || [])
      }
    } catch (error) {
      toast.error("Failed to load predictions")
      setPredictions([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleScheduleMaintenance = async (truck: any, need: any) => {
    setSchedulingId(`${truck.truck_id}-${need.type}`)
    try {
      const result = await createMaintenanceFromPrediction({
        truck_id: truck.truck_id,
        service_type: need.type,
        estimated_cost: 0,
        notes: need.reason,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Maintenance scheduled: ${need.type}`)
        // Reload predictions
        await loadPredictions()
      }
    } catch (error) {
      toast.error("Failed to schedule maintenance")
    } finally {
      setSchedulingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
          <h1 className="text-3xl font-bold text-foreground">Predictive Maintenance</h1>
        </div>
        <div className="p-8">
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Loading predictions...</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Predictive Maintenance</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              AI-powered maintenance predictions based on usage patterns
            </p>
          </div>
          <Button onClick={loadPredictions} variant="outline" className="w-full sm:w-auto">
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          {predictions.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No maintenance predictions at this time</p>
              <p className="text-xs text-muted-foreground mt-2">
                All trucks are up to date with their maintenance schedules
              </p>
            </Card>
          ) : (
            predictions.map((truck, index) => (
              <Card key={index} className="p-6 border border-border/50">
                <div className="mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                    <h3 className="text-base sm:text-lg font-semibold text-foreground break-words">
                      {truck.truck_number} - {truck.make} {truck.model}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded flex-shrink-0 ${
                      truck.priority === "high" 
                        ? "bg-red-500/10 text-red-500" 
                        : truck.priority === "medium"
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-blue-500/10 text-blue-500"
                    }`}>
                      {truck.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Current Mileage</p>
                        <p className="font-medium text-foreground">
                          {truck.current_mileage.toLocaleString()} miles
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Miles Since Last Maintenance</p>
                        <p className="font-medium text-foreground">
                          {truck.miles_since_last_maintenance.toLocaleString()} miles
                        </p>
                      </div>
                    </div>
                    {truck.last_maintenance_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Last Maintenance</p>
                          <p className="font-medium text-foreground">
                            {new Date(truck.last_maintenance_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {truck.predicted_needs && truck.predicted_needs.length > 0 && (
                  <div className="space-y-3 mt-4 pt-4 border-t">
                    <h4 className="font-semibold text-sm">Predicted Maintenance Needs:</h4>
                    {truck.predicted_needs.map((need: any, needIndex: number) => (
                      <div key={needIndex} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 bg-secondary rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Wrench className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium">{need.type}</span>
                            <span className={`px-2 py-0.5 text-xs rounded flex-shrink-0 ${
                              need.priority === "high" 
                                ? "bg-red-500/10 text-red-500" 
                                : "bg-yellow-500/10 text-yellow-500"
                            }`}>
                              {need.priority.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2 break-words">{need.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            Estimated at: {need.estimated_mileage.toLocaleString()} miles
                          </p>
                        </div>
                        <Button
                          onClick={() => handleScheduleMaintenance(truck, need)}
                          className="w-full sm:w-auto sm:ml-4 flex-shrink-0"
                          size="sm"
                          disabled={schedulingId === `${truck.truck_id}-${need.type}`}
                        >
                          {schedulingId === `${truck.truck_id}-${need.type}` ? "Scheduling..." : "Schedule"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}


