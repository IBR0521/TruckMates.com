# ProMiles-equivalent (trip planning)

Server-side module for **truck-legal routing**, **planning-time state mileage**, **EIA diesel estimates**, and **HERE Routing toll estimates** (`return=tolls`).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOOGLE_MAPS_API_KEY` | **Yes** | Geocoding + fallback Directions polyline + state lookup along route |
| `HERE_API_KEY` | No* | **HERE Routing v8** truck polyline **and** toll totals (`return=tolls`; same request) |
| `EIA_API_KEY` | No | [EIA Open Data](https://www.eia.gov/opendata/) — weekly retail diesel by PADD / sub-PADD |

\*If `HERE_API_KEY` is missing, routing uses **Google Directions** (same as today — not true truck mode). Warnings are included in the response.

## API (server actions)

- `getTripPlanningEstimate({ origin, destination, deliveryStopAddresses?, mpg?, truck? })` → full estimate object  
  - When **`deliveryStopAddresses`** is set (ordered stop 1…N), the route is **pickup → all stops → last** (HERE `via` / Google waypoints), so mileage matches the full multi-stop chain—not only the first-to-last leg.
- `saveTripPlanningEstimateOnLoad(loadId, estimate)` → persists JSON on `loads.trip_planning_estimate`

## In the app

- **IFTA → Trip planning** — **`/dashboard/ifta/trip-planning`** — run estimates without opening a load (not saved).
- **Load detail** — **`/dashboard/loads/[id]`** — same engine; **Calculate & save** stores JSON on the load.

Requires `GOOGLE_MAPS_API_KEY`; optional keys add HERE truck routing + tolls, EIA fuel $ (see warnings on the card).

## Database

Run in Supabase SQL editor (or migrate):

`supabase/promiles_load_estimate.sql`

Adds `loads.trip_planning_estimate` (JSONB).

## Files

- `app/actions/promiles.ts` — orchestration
- `lib/promiles/here-truck-route.ts` — HERE truck polyline
- `lib/promiles/state-mileage.ts` — state miles from path (segment midpoints + geocode)
- `lib/promiles/eia-diesel.ts` — PADD diesel + fuel cost
- `lib/promiles/here-truck-route.ts` — HERE truck route + toll sum from API response
- `lib/promiles/polyline-google.ts` — decode Google encoded polyline
- `lib/geo/state-from-latlng.ts` — state code from lat/lng

## Next steps (product)

1. ~~Call `getTripPlanningEstimate` from load UI~~ — done on load detail (`LoadTripPlanningEstimate`).
2. On trip complete, replace estimates with **actual** miles from `state_crossings` / ELD (existing IFTA path).
3. Tolls use the **same** HERE truck route response as the polyline (cheapest USD fare per toll facility).
