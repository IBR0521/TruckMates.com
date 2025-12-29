"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Calendar, DollarSign, TrendingUp } from "lucide-react"
import { toast } from "sonner"
// import { predictMaintenanceNeeds, createMaintenanceFromPrediction } from "@/app/actions/maintenance-predictive"

export default function PredictiveMaintenancePage() {
  const [predictions, setPredictions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPredictions()
  }, [])

  const loadPredictions = async () => {
    setIsLoading(true)
    try {
      // TODO: Implement predictMaintenanceNeeds function
      // const result = await predictMaintenanceNeeds()
      // if (result.error) {
      //   toast.error(result.error)
      // } else {
      //   setPredictions(result.data?.predictions || [])
      // }
      setPredictions([])
      // Predictive maintenance feature - coming soon
      // Removed toast to avoid user confusion
    } catch (error) {
      toast.error("Failed to load predictions")
    } finally {
      setIsLoading(false)
    }
  }

  const handleScheduleMaintenance = async (prediction: any) => {
    try {
      // TODO: Implement createMaintenanceFromPrediction function
      // const result = await createMaintenanceFromPrediction(
      //   prediction.truck_id,
      //   prediction.service_type,
      //   prediction.predicted_date
      // )
      // Feature coming soon - removed toast
    } catch (error) {
      toast.error("Failed to schedule maintenance")
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Predictive Maintenance</h1>
            <p className="text-muted-foreground text-sm mt-1">
              AI-powered maintenance predictions based on usage patterns
            </p>
          </div>
          <Button onClick={loadPredictions} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {predictions.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No maintenance predictions at this time</p>
            </Card>
          ) : (
            predictions.map((prediction, index) => (
              <Card key={index} className="p-6 border border-border/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {prediction.truck_number}
                      </h3>
                      <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                        {prediction.confidence}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{prediction.service_type}</p>
                    
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Predicted Date</p>
                          <p className="text-sm font-medium text-foreground">
                            {new Date(prediction.predicted_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {prediction.estimated_cost && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Estimated Cost</p>
                            <p className="text-sm font-medium text-foreground">
                              ${prediction.estimated_cost.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <p className="text-sm font-medium text-foreground">
                            {prediction.confidence}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">{prediction.reason}</p>
                  </div>
                  <Button
                    onClick={() => handleScheduleMaintenance(prediction)}
                    className="ml-4"
                    size="sm"
                  >
                    Schedule
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}


