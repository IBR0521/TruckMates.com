# Enhanced Address Book Implementation

## Overview
The Enhanced Address Book transforms a simple contact list into a powerful operational database with PostGIS geo-verification, role-based categorization, OCR extraction, and geofencing integration.

## Features Implemented

### 1. PostGIS Geo-Verification & POI Naming ✅
- **Database Schema**: `address_book` table with `GEOGRAPHY(POINT, 4326)` column
- **Geocoding Integration**: Automatic geocoding via Google Maps API on address entry
- **Verified Coordinates**: Every address stores verified lat/lng as PostGIS geography point
- **Status Tracking**: `geocoding_status` field tracks: `pending`, `verified`, `failed`, `manual`
- **Place ID Storage**: Google Maps Place ID stored for future reference

### 2. Role-Based Categorization & Custom Fields ✅
- **Categories**: `shipper`, `receiver`, `vendor`, `broker`, `driver`, `warehouse`, `repair_shop`, `fuel_station`, `other`
- **Custom Fields**: JSONB field for category-specific data:
  - **Shipper/Receiver**: `gate_code`, `warehouse_hours`, `accepts_flatbed_after_3pm`, `loading_instructions`, `dock_count`
  - **Broker**: `mc_number`, `contact_preference`
  - **Vendor**: `service_type`, `special_equipment_required`
- **Mandatory Fields**: Category-specific fields can be enforced in UI

### 3. Automated Address Capture from Rate Cons ✅
- **OCR Integration**: Uses existing `analyzeDocument` function with OpenAI Vision API
- **Extraction Logic**: Automatically extracts shipper and receiver addresses from Rate Confirmation PDFs
- **Draft Entries**: Creates draft address book entries for human verification
- **Auto-Geocoding**: Automatically geocodes extracted addresses

### 4. Integration with Map & Zones (Geofencing) ✅
- **Auto-Create Geofences**: Option to automatically create geofence when address is verified
- **Linked Geofences**: `geofence_id` links address book entry to geofence
- **Configurable Radius**: `geofence_radius_meters` (default 500m)
- **Trigger Function**: `auto_create_address_geofence()` automatically creates geofence on verification
- **Proximity Alerts**: Address book entries can trigger alerts when drivers are nearby

## Database Schema

### Table: `address_book`
```sql
- id (UUID, Primary Key)
- company_id (UUID, Foreign Key)
- name, company_name, contact_name
- email, phone, fax
- address_line1, address_line2, city, state, zip_code, country
- coordinates (GEOGRAPHY(POINT, 4326)) -- PostGIS verified coordinates
- geocoded_at, geocoding_status, formatted_address, place_id
- category (TEXT) -- Role-based categorization
- custom_fields (JSONB) -- Category-specific fields
- notes, is_active, is_verified
- auto_create_geofence, geofence_id, geofence_radius_meters
- created_by, created_at, updated_at
- last_used_at, usage_count
```

### Indexes
- GIST index on `coordinates` for spatial queries
- Indexes on `company_id`, `category`, `city/state`, `is_active`, `geocoding_status`
- Full-text search index on name, company_name, city, state

### Functions
- `find_nearby_addresses()`: PostGIS function to find addresses within radius
- `increment_address_usage()`: Track when address is used in loads/routes
- `auto_create_address_geofence()`: Auto-create geofence on verification
- `get_point_coordinates()`: Extract lat/lng from PostGIS geography

## API Functions

### `createAddressBookEntry(input)`
- Creates new address book entry
- Auto-geocodes address if `auto_geocode !== false`
- Stores coordinates as PostGIS geography point
- Auto-creates geofence if `auto_create_geofence = true`

### `getAddressBookEntries(filters)`
- Get all entries with filters (search, category, status, etc.)
- Converts PostGIS coordinates to lat/lng for response
- Supports pagination

### `findNearbyAddresses(lat, lng, options)`
- Uses PostGIS `ST_DWithin` to find addresses within radius
- Returns distance in km
- Can filter by category

### `geocodeAddressBookEntry(entryId)`
- Re-geocode an existing entry
- Updates coordinates, status, formatted_address, place_id

### `extractAddressesFromRateCon(fileUrl, fileName)`
- Uses OCR/AI to extract shipper and receiver addresses
- Returns draft entries ready for verification
- Auto-geocodes extracted addresses

### `updateAddressBookEntry(entryId, updates)`
- Update entry fields
- Re-geocodes if address changed
- Updates linked geofence if needed

### `deleteAddressBookEntry(entryId)`
- Soft delete (sets `is_active = false`) or hard delete
- Removes linked geofence if auto-created

### `incrementAddressUsage(entryId)`
- Called when address is used in load/route
- Tracks usage count and last used timestamp

## Integration Points

### 1. Load Creation
- When creating a load, dispatcher can select from address book
- Automatically increments usage count
- Uses verified coordinates for route optimization

### 2. Route Optimization
- Address book entries with verified coordinates improve route accuracy
- PostGIS distance calculations for nearby addresses

### 3. Geofencing
- Address book entries can auto-create geofences
- Geofence alerts can reference address book entry name
- "Driver is 1 mile away from [Address Book Entry #452 (Walmart DC)]"

### 4. Dispatch Board
- Show address book entries on map
- Filter loads by address book category
- Quick access to operational details (gate codes, hours, etc.)

## Next Steps

1. **UI Implementation**: Create enhanced address book page with:
   - Category-based form fields
   - Geocoding status indicators
   - Map view of addresses
   - OCR upload for Rate Cons
   - Geofence management

2. **Load Integration**: Update load creation to:
   - Use address book entries
   - Auto-increment usage
   - Show custom fields in dispatch board

3. **Geofencing Integration**: Enhance geofencing to:
   - Show address book entry name in alerts
   - Link geofences to address book entries
   - Auto-update geofence when address changes

4. **Analytics**: Track:
   - Most used addresses
   - Address verification rates
   - Geocoding success rates

## Migration Instructions

1. Run `supabase/enhanced_address_book.sql` in Supabase SQL Editor
2. Ensure PostGIS extension is enabled
3. Update existing address book entries to use new schema (optional migration script)
4. Test geocoding with sample addresses
5. Test OCR extraction with sample Rate Con PDFs

## Benefits

1. **Eliminates Delivery Errors**: Verified coordinates prevent routing to wrong locations
2. **Operational Context**: Custom fields ensure dispatchers have critical details
3. **Time Savings**: OCR extraction speeds up data entry
4. **Automation**: Auto-created geofences enable proximity alerts
5. **Data Quality**: PostGIS ensures spatial data integrity



