# ELD Mobile API Documentation

API endpoints for Electronic Logging Device (ELD) mobile app integration.

## Base URL

All ELD endpoints are prefixed with `/api/eld/mobile/`

## Authentication

All endpoints require authentication via Supabase Auth token in the Authorization header:

```
Authorization: Bearer <supabase-auth-token>
```

## Register Device

Register a mobile device as an ELD device.

**Endpoint:** `POST /api/eld/mobile/register`

### Request Body

```json
{
  "device_name": "John's iPhone",
  "device_serial_number": "unique-device-id-12345",
  "truck_id": "optional-truck-uuid",
  "app_version": "1.0.0",
  "device_info": {
    "model": "iPhone 14 Pro",
    "os": "iOS 17.0",
    "platform": "ios"
  }
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `device_name` | string | Yes | Human-readable device name |
| `device_serial_number` | string | Yes | Unique device identifier (must be unique across all devices) |
| `truck_id` | string (UUID) | No | Optional truck assignment |
| `app_version` | string | No | Mobile app version |
| `device_info` | object | No | Device metadata (model, OS, platform) |

### Response

**Success (200):**

```json
{
  "success": true,
  "device_id": "uuid-of-registered-device",
  "device": {
    "id": "uuid-of-registered-device",
    "device_name": "John's iPhone",
    "device_serial_number": "unique-device-id-12345",
    "status": "active"
  },
  "message": "Device registered successfully"
}
```

**Error (400):**

```json
{
  "error": "Device name and serial number are required"
}
```

**Error (401):**

```json
{
  "error": "Not authenticated"
}
```

### Notes

- Device serial number must be unique. If a device with the same serial number exists, it will be updated.
- The device is automatically set to "active" status upon registration.
- Provider is automatically set to "truckmates_mobile".

---

## Location Updates

Send GPS location updates from the mobile app.

**Endpoint:** `POST /api/eld/mobile/locations`

### Request Body

```json
{
  "device_id": "device-uuid-from-register",
  "locations": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "123 Main St, New York, NY",
      "speed": 55.5,
      "heading": 180,
      "odometer": 123456,
      "engine_status": "on",
      "driver_id": "optional-driver-uuid"
    }
  ]
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `device_id` | string (UUID) | Yes | Device ID from register endpoint |
| `locations` | array | Yes | Array of location objects (max 100 per request) |

#### Location Object

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timestamp` | string (ISO 8601) | Yes | Location timestamp |
| `latitude` | number | Yes | Latitude coordinate (-90 to 90) |
| `longitude` | number | Yes | Longitude coordinate (-180 to 180) |
| `address` | string | No | Human-readable address |
| `speed` | number | No | Speed in MPH |
| `heading` | number | No | Heading in degrees (0-360) |
| `odometer` | number | No | Odometer reading |
| `engine_status` | string | No | Engine status: "on", "off", or "idle" |
| `driver_id` | string (UUID) | No | Driver ID if known |

### Response

**Success (200):**

```json
{
  "success": true,
  "inserted": 1,
  "message": "Successfully inserted 1 location(s)"
}
```

**Error (400):**

```json
{
  "error": "device_id and locations array are required"
}
```

**Error (404):**

```json
{
  "error": "Device not found or access denied"
}
```

### Notes

- Locations are inserted in batches of 100 to avoid timeouts.
- Invalid locations (missing lat/lng) are automatically filtered out.
- Device `last_sync_at` is automatically updated after successful insertion.

---

## HOS Logs

Sync Hours of Service (HOS) log entries from the mobile app.

**Endpoint:** `POST /api/eld/mobile/logs`

### Request Body

```json
{
  "device_id": "device-uuid-from-register",
  "logs": [
    {
      "log_date": "2024-01-15",
      "log_type": "driving",
      "start_time": "2024-01-15T08:00:00Z",
      "end_time": "2024-01-15T10:30:00Z",
      "duration_minutes": 150,
      "location_start": {
        "lat": 40.7128,
        "lng": -74.0060,
        "address": "123 Main St, New York, NY"
      },
      "location_end": {
        "lat": 41.8781,
        "lng": -87.6298,
        "address": "456 Oak Ave, Chicago, IL"
      },
      "odometer_start": 123456,
      "odometer_end": 123789,
      "miles_driven": 333,
      "engine_hours": 2.5,
      "violations": ["Exceeded 11-hour driving limit"],
      "driver_id": "optional-driver-uuid"
    }
  ]
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `device_id` | string (UUID) | Yes | Device ID from register endpoint |
| `logs` | array | Yes | Array of HOS log objects |

#### HOS Log Object

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `log_date` | string (YYYY-MM-DD) | Yes | Date of the log entry |
| `log_type` | string | Yes | Log type: "driving", "on_duty", "off_duty", or "sleeper_berth" |
| `start_time` | string (ISO 8601) | Yes | Start time of the log entry |
| `end_time` | string (ISO 8601) | No | End time (null if ongoing) |
| `duration_minutes` | number | No | Duration in minutes |
| `location_start` | object | No | Start location with lat, lng, address |
| `location_end` | object | No | End location with lat, lng, address |
| `odometer_start` | number | No | Starting odometer reading |
| `odometer_end` | number | No | Ending odometer reading |
| `miles_driven` | number | No | Miles driven during this period |
| `engine_hours` | number | No | Engine hours |
| `violations` | array | No | Array of violation descriptions |
| `driver_id` | string (UUID) | No | Driver ID if known |

### Response

**Success (200):**

```json
{
  "success": true,
  "inserted": 1,
  "message": "Successfully synced 1 log(s)"
}
```

**Error (400):**

```json
{
  "error": "device_id and logs array are required"
}
```

### Notes

- Logs are upserted (updated if exists, inserted if new) based on log ID.
- Invalid logs (missing log_type or start_time) are automatically filtered out.
- Device `last_sync_at` is automatically updated after successful sync.

---

## Events

Report events and violations from the mobile app.

**Endpoint:** `POST /api/eld/mobile/events`

### Request Body

```json
{
  "device_id": "device-uuid-from-register",
  "events": [
    {
      "event_type": "hos_violation",
      "severity": "critical",
      "title": "Drive Time Violation",
      "description": "Exceeded maximum 11-hour drive time limit",
      "event_time": "2024-01-15T10:30:00Z",
      "location": {
        "lat": 40.7128,
        "lng": -74.0060,
        "address": "123 Main St, New York, NY"
      },
      "metadata": {
        "remaining_drive_time": 0,
        "current_drive_time": 11.5
      },
      "driver_id": "optional-driver-uuid"
    }
  ]
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `device_id` | string (UUID) | Yes | Device ID from register endpoint |
| `events` | array | Yes | Array of event objects |

#### Event Object

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event_type` | string | Yes | Event type: "hos_violation", "speeding", "hard_brake", "hard_accel", "device_malfunction", or "other" |
| `severity` | string | No | Severity level: "info", "warning", or "critical" (default: "warning") |
| `title` | string | Yes | Event title |
| `description` | string | No | Detailed description |
| `event_time` | string (ISO 8601) | Yes | When the event occurred |
| `location` | object | No | Location with lat, lng, address |
| `metadata` | object | No | Additional event data |
| `driver_id` | string (UUID) | No | Driver ID if known |

### Response

**Success (200):**

```json
{
  "success": true,
  "inserted": 1,
  "message": "Successfully synced 1 event(s)"
}
```

**Error (400):**

```json
{
  "error": "device_id and events array are required"
}
```

### Notes

- Events are automatically set to `resolved: false` upon creation.
- Invalid events (missing event_type or title) are automatically filtered out.
- Device `last_sync_at` is automatically updated after successful sync.

---

## Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication token missing or invalid |
| `DEVICE_NOT_FOUND` | Device ID not found or doesn't belong to user's company |
| `INVALID_INPUT` | Request body validation failed |
| `DUPLICATE_DEVICE` | Device serial number already exists |
| `RATE_LIMIT_EXCEEDED` | Too many requests in time window |

## Best Practices

1. **Batch Requests**: Send multiple locations/logs/events in a single request when possible (up to 100 items).
2. **Error Handling**: Always check the response status and handle errors gracefully.
3. **Retry Logic**: Implement exponential backoff for retries on 5xx errors.
4. **Offline Support**: Queue requests when offline and sync when connection is restored.
5. **Rate Limiting**: Respect rate limits and implement request throttling.

## Example Usage

### JavaScript/TypeScript

```typescript
// Register device
const registerDevice = async (deviceName: string, serialNumber: string) => {
  const response = await fetch('/api/eld/mobile/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      device_name: deviceName,
      device_serial_number: serialNumber,
    }),
  })
  return await response.json()
}

// Send location update
const sendLocation = async (deviceId: string, location: Location) => {
  const response = await fetch('/api/eld/mobile/locations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      device_id: deviceId,
      locations: [location],
    }),
  })
  return await response.json()
}
```

### React Native

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Register device
const registerDevice = async () => {
  const { data, error } = await supabase.functions.invoke('eld-mobile-register', {
    body: {
      device_name: 'My iPhone',
      device_serial_number: DeviceInfo.getUniqueId(),
    },
  })
  return { data, error }
}
```




