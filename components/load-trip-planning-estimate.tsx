"use client"

import { TripPlanningEstimatorPanel, type TripPlanningEstimatorPanelProps } from "@/components/trip-planning-estimator-panel"
import type { TripPlanningEstimate } from "@/app/actions/promiles"

type Props = {
  loadId: string
  origin: string | null | undefined
  destination: string | null | undefined
  initialEstimate?: TripPlanningEstimate | null
  truckGrossWeightLbs?: number | null
  /** Last delivery stop address when destination is "Multiple Locations" */
  suggestedRoutingDestination?: string | null
  /** Ordered stop addresses (stop 1 … N) for full-chain mileage when multi-delivery */
  deliveryStopAddresses?: string[]
  onSaved?: () => void | Promise<void>
}

/** Trip planning on a load — saves estimate to `loads.trip_planning_estimate`. */
export function LoadTripPlanningEstimate(props: Props) {
  const panelProps: TripPlanningEstimatorPanelProps = {
    loadId: props.loadId,
    origin: props.origin,
    destination: props.destination,
    initialEstimate: props.initialEstimate,
    truckGrossWeightLbs: props.truckGrossWeightLbs,
    suggestedRoutingDestination: props.suggestedRoutingDestination,
    deliveryStopAddresses: props.deliveryStopAddresses,
    onSaved: props.onSaved,
    idPrefix: "load-tpe",
  }
  return <TripPlanningEstimatorPanel {...panelProps} />
}
