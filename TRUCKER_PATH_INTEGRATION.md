# Trucker Path Navigation Integration

## Overview

The navigation button now opens **Trucker Path** instead of Google Maps. Trucker Path is specifically designed for truck drivers with features like:
- Truck-specific routes (avoiding low bridges, weight restrictions)
- Truck stops and parking locations
- Fuel prices at truck stops
- Height/weight restrictions awareness
- Better routing for commercial vehicles

## How It Works

### On Mobile Devices (iOS/Android)

1. **Tries to open Trucker Path app** using deep link: `truckerpath://route?saddr=...&daddr=...`
2. **If app is installed:** Opens directly in Trucker Path app
3. **If app is not installed:** Shows a prompt to install it or use web interface

### On Desktop/Web

1. **Opens Trucker Path web interface** at `https://truckerpath.com/route-planner`
2. Users can plan routes on the web or install the mobile app

## URL Format

### Trucker Path Deep Link Format

```
truckerpath://route?saddr=ORIGIN&daddr=DESTINATION&paddr=WAYPOINT1|WAYPOINT2
```

**Parameters:**
- `saddr`: Starting address or coordinates (lat,lng)
- `daddr`: Destination address or coordinates (lat,lng)
- `paddr`: Waypoints separated by `|` (for multi-stop routes)

**Examples:**
- Simple route: `truckerpath://route?saddr=New York, NY&daddr=Los Angeles, CA`
- With coordinates: `truckerpath://route?saddr=40.7128,-74.0060&daddr=34.0522,-118.2437`
- Multi-stop: `truckerpath://route?saddr=NY&daddr=CA&paddr=PA|OH|IL`

## Features

✅ **Uses coordinates when available** (more accurate)
✅ **Falls back to addresses** if coordinates not available
✅ **Supports multi-stop routes** (all waypoints included)
✅ **Mobile app deep linking** (opens app if installed)
✅ **Web fallback** (opens web interface on desktop)
✅ **Truck-specific routing** (height, weight, hazmat aware)

## Installation

Users need to install Trucker Path app on their mobile device:

- **iOS:** App Store - Search "Trucker Path"
- **Android:** Google Play Store - Search "Trucker Path"

## Testing

1. **On Mobile:**
   - Click "Start Truck Navigation"
   - Trucker Path app should open (if installed)
   - Route should be pre-filled with origin, destination, and stops

2. **On Desktop:**
   - Click "Start Truck Navigation"
   - Trucker Path web interface should open
   - Route can be planned on web

## Benefits Over Google Maps

- ✅ Truck-specific routes (avoids residential roads, low bridges)
- ✅ Truck stop locations and parking
- ✅ Fuel prices at truck stops
- ✅ Height/weight restriction warnings
- ✅ Better for commercial vehicle navigation
- ✅ Designed specifically for truck drivers
