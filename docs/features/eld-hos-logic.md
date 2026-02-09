# ELD HOS (Hours of Service) Logic Documentation

Comprehensive documentation of Hours of Service calculation rules and logic implemented in TruckMates.

## Overview

TruckMates implements full FMCSA (Federal Motor Carrier Safety Administration) Hours of Service regulations for commercial vehicle drivers. The system automatically calculates remaining drive time, on-duty time, and detects violations in real-time.

## HOS Rules

The system enforces the following FMCSA HOS rules:

| Rule | Limit | Description |
|------|-------|-------------|
| **Maximum Driving Hours** | 11 hours | Maximum consecutive driving time before required break |
| **Maximum On-Duty Hours** | 14 hours | Maximum on-duty time (driving + on-duty not driving) in a 14-hour window |
| **Minimum Off-Duty Hours** | 10 hours | Minimum off-duty time required before starting next shift |
| **Required Break** | 30 minutes | Minimum break required after 8 hours of driving |
| **Maximum Driving (7 days)** | 60 hours | Maximum driving hours in any 7 consecutive days |
| **Maximum Driving (8 days)** | 70 hours | Maximum driving hours in any 8 consecutive days |

## Calculation Methodology

### Daily HOS Calculation

The system calculates HOS for each driver on a daily basis using the following process:

1. **Retrieve Logs**: Fetch all ELD logs for the driver for the current day
2. **Categorize Time**: Sum time by log type:
   - **Driving**: Time spent driving (counts toward both driving and on-duty limits)
   - **On-Duty**: Time on-duty but not driving (counts toward on-duty limit only)
   - **Off-Duty**: Time off-duty (doesn't count toward any limit)
   - **Sleeper Berth**: Time in sleeper berth (counts as off-duty)
3. **Calculate Totals**: Convert minutes to hours
4. **Calculate Remaining**: Subtract used hours from maximum limits
5. **Check Violations**: Compare against limits and detect violations

### Remaining Hours Calculation

#### Remaining Driving Hours

```
Remaining Driving = MAX(0, 11 - Total Driving Hours)
```

**Example:**
- Driver has driven 8.5 hours today
- Remaining driving = MAX(0, 11 - 8.5) = 2.5 hours

#### Remaining On-Duty Hours

```
Remaining On-Duty = MAX(0, 14 - Total On-Duty Hours)
```

**On-Duty Hours Include:**
- All driving time
- All on-duty (not driving) time

**Example:**
- Driver has 8.5 hours driving + 2 hours on-duty (not driving) = 10.5 hours total on-duty
- Remaining on-duty = MAX(0, 14 - 10.5) = 3.5 hours

### Break Requirement Logic

A 30-minute break is required after 8 hours of driving:

```
Break Required = (Driving Hours >= 8) AND (Off-Duty Hours < 0.5)
```

**Example Scenarios:**

1. **Break Required:**
   - Driving: 8.5 hours
   - Off-duty: 0.2 hours (12 minutes)
   - Result: Break required (needs 18 more minutes off-duty)

2. **Break Satisfied:**
   - Driving: 8.5 hours
   - Off-duty: 0.6 hours (36 minutes)
   - Result: Break satisfied, can continue driving

### Rolling Window Calculations

For more accurate calculations, the system uses rolling windows:

#### 11-Hour Driving Window

Calculates total driving time in the last 11 hours (rolling window):

```
11 Hours Ago = Current Time - 11 hours
Total Driving = Sum of all driving logs since 11 hours ago
Remaining = 11 hours - Total Driving
```

#### 14-Hour On-Duty Window

Calculates total on-duty time in the last 14 hours (rolling window):

```
14 Hours Ago = Current Time - 14 hours
Total On-Duty = Sum of all (driving + on-duty) logs since 14 hours ago
Remaining = 14 hours - Total On-Duty
```

## Log Types

The system recognizes four log types:

### 1. Driving

**Definition:** Driver is actively operating the vehicle.

**Characteristics:**
- Counts toward both driving and on-duty limits
- Vehicle must be in motion
- Automatically detected by ELD device or manually entered

**Example:**
```json
{
  "log_type": "driving",
  "start_time": "2024-01-15T08:00:00Z",
  "end_time": "2024-01-15T10:30:00Z",
  "duration_minutes": 150
}
```

### 2. On-Duty (Not Driving)

**Definition:** Driver is on-duty but not driving (loading, unloading, inspections, etc.).

**Characteristics:**
- Counts toward on-duty limit only
- Does NOT count toward driving limit
- Can be manually entered or detected by ELD

**Example:**
```json
{
  "log_type": "on_duty",
  "start_time": "2024-01-15T10:30:00Z",
  "end_time": "2024-01-15T11:00:00Z",
  "duration_minutes": 30
}
```

### 3. Off-Duty

**Definition:** Driver is completely off-duty (not working).

**Characteristics:**
- Does NOT count toward any limits
- Required for break calculation
- Resets the 14-hour on-duty window after 10 hours

**Example:**
```json
{
  "log_type": "off_duty",
  "start_time": "2024-01-15T11:00:00Z",
  "end_time": "2024-01-15T21:00:00Z",
  "duration_minutes": 600
}
```

### 4. Sleeper Berth

**Definition:** Driver is in sleeper berth (resting in vehicle).

**Characteristics:**
- Counts as off-duty time
- Can be used to satisfy 10-hour rest requirement
- Can be used for split sleeper berth (advanced)

**Example:**
```json
{
  "log_type": "sleeper_berth",
  "start_time": "2024-01-15T21:00:00Z",
  "end_time": "2024-01-16T07:00:00Z",
  "duration_minutes": 600
}
```

## Violation Detection

The system automatically detects the following violations:

### 1. Drive Time Violation

**Trigger:** Driver exceeds 11 hours of driving in a rolling 11-hour window.

**Severity:** Critical

**Detection Logic:**
```typescript
if (remainingDriveTime <= 0 && currentStatus === 'driving') {
  violation = {
    type: 'hos_violation',
    severity: 'critical',
    title: 'Drive Time Violation',
    description: 'Exceeded maximum 11-hour drive time limit'
  }
}
```

**Example:**
- Driver has been driving for 11.5 hours in the last 11 hours
- Violation detected immediately when limit is exceeded

### 2. On-Duty Time Violation

**Trigger:** Driver exceeds 14 hours of on-duty time in a rolling 14-hour window.

**Severity:** Critical

**Detection Logic:**
```typescript
if (remainingOnDutyTime <= 0) {
  violation = {
    type: 'hos_violation',
    severity: 'critical',
    title: 'On-Duty Time Violation',
    description: 'Exceeded maximum 14-hour on-duty time limit'
  }
}
```

**Example:**
- Driver has 8 hours driving + 6.5 hours on-duty = 14.5 hours total on-duty
- Violation detected when limit is exceeded

### 3. Break Required Violation

**Trigger:** Driver has driven 8+ hours without a 30-minute break.

**Severity:** Warning

**Detection Logic:**
```typescript
if (drivingHours >= 8 && offDutyHours < 0.5) {
  violation = {
    type: 'hos_violation',
    severity: 'warning',
    title: 'Break Required',
    description: '30-minute break required after 8 hours on duty'
  }
}
```

**Example:**
- Driver has been driving for 8.5 hours
- Has only 15 minutes of off-duty time
- Violation detected (needs 15 more minutes off-duty)

## Calculation Examples

### Example 1: Normal Day

**Scenario:**
- 8:00 AM - 12:00 PM: Driving (4 hours)
- 12:00 PM - 12:30 PM: Off-duty break (0.5 hours)
- 12:30 PM - 4:30 PM: Driving (4 hours)
- 4:30 PM - 5:00 PM: On-duty (loading) (0.5 hours)
- 5:00 PM - 7:00 AM next day: Off-duty (14 hours)

**Calculations:**
- Total Driving: 4 + 4 = 8 hours
- Total On-Duty: 4 + 4 + 0.5 = 8.5 hours
- Total Off-Duty: 0.5 + 14 = 14.5 hours
- Remaining Driving: 11 - 8 = 3 hours
- Remaining On-Duty: 14 - 8.5 = 5.5 hours
- Break Required: No (had 30-minute break after 4 hours)

**Result:** ✅ No violations, can continue driving

### Example 2: Violation Scenario

**Scenario:**
- 6:00 AM - 2:00 PM: Driving (8 hours)
- 2:00 PM - 2:15 PM: Off-duty (0.25 hours / 15 minutes)
- 2:15 PM - 4:15 PM: Driving (2 hours)
- Total: 10 hours driving, 0.25 hours off-duty

**Calculations:**
- Total Driving: 10 hours
- Total On-Duty: 10 hours
- Total Off-Duty: 0.25 hours (15 minutes)
- Remaining Driving: 11 - 10 = 1 hour
- Remaining On-Duty: 14 - 10 = 4 hours
- Break Required: Yes (drove 8+ hours, only 15 minutes off-duty, needs 15 more minutes)

**Result:** ⚠️ Break required violation (needs 15 more minutes off-duty)

### Example 3: Critical Violation

**Scenario:**
- 6:00 AM - 5:30 PM: Driving (11.5 hours)

**Calculations:**
- Total Driving: 11.5 hours
- Remaining Driving: 11 - 11.5 = -0.5 hours (exceeded!)

**Result:** ❌ Critical violation - exceeded 11-hour driving limit

## API Reference

### Calculate Remaining HOS

**Endpoint:** Server Action `calculateRemainingHOS(driverId, date?)`

**Parameters:**
- `driverId` (string, required): Driver UUID
- `date` (string, optional): Date in YYYY-MM-DD format (defaults to today)

**Returns:**
```typescript
{
  data: {
    drivingHours: number,        // Total driving hours today
    onDutyHours: number,          // Total on-duty hours today
    offDutyHours: number,         // Total off-duty hours today
    remainingDriving: number,     // Remaining driving hours
    remainingOnDuty: number,      // Remaining on-duty hours
    needsBreak: boolean,          // Whether break is required
    violations: string[],         // Array of violation messages
    canDrive: boolean             // Whether driver can continue driving
  },
  error: string | null
}
```

**Example Usage:**
```typescript
const result = await calculateRemainingHOS(driverId)
if (result.data) {
  console.log(`Remaining driving: ${result.data.remainingDriving} hours`)
  console.log(`Can drive: ${result.data.canDrive}`)
  if (result.data.violations.length > 0) {
    console.log('Violations:', result.data.violations)
  }
}
```

## Implementation Details

### Code Locations

- **HOS Calculation Logic**: `app/actions/eld-advanced.ts`
- **Violation Detection**: `truckmates-eld-mobile/src/services/hosService.ts`
- **HOS Rules Constants**: Defined in `app/actions/eld-advanced.ts`

### Database Schema

HOS logs are stored in the `eld_logs` table:

```sql
CREATE TABLE eld_logs (
  id UUID PRIMARY KEY,
  company_id UUID,
  eld_device_id UUID,
  driver_id UUID,
  truck_id UUID,
  log_date DATE,
  log_type TEXT, -- 'driving', 'on_duty', 'off_duty', 'sleeper_berth'
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_minutes INTEGER,
  location_start JSONB,
  location_end JSONB,
  odometer_start INTEGER,
  odometer_end INTEGER,
  miles_driven DECIMAL,
  violations JSONB
);
```

## Compliance

This implementation follows FMCSA regulations:

- **49 CFR Part 395** - Hours of Service of Drivers
- **ELD Mandate** - Electronic Logging Device requirements
- **Property-Carrying Vehicles** - 11/14-hour rule
- **Passenger-Carrying Vehicles** - 10/15-hour rule (not currently implemented)

## Notes

- Calculations are performed in real-time as logs are created
- Violations are automatically detected and stored in `eld_events` table
- The system supports both automatic (ELD device) and manual log entry
- All calculations use UTC timestamps for consistency
- The system handles timezone conversions automatically

## Future Enhancements

Planned improvements:

1. **Split Sleeper Berth**: Support for 8/2 split sleeper berth option
2. **Passenger Vehicles**: Support for 10/15-hour rule for passenger-carrying vehicles
3. **Regional Variations**: Support for state-specific HOS rules
4. **Exemptions**: Support for short-haul and other exemptions
5. **7/8 Day Calculations**: Weekly hour limit tracking and violations





