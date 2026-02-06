# External Broker/Load Board Integrations
TruckMates Platform - DAT, Truckstop, 123Loadboard Integration Guide

## Overview

TruckMates supports integration with major external load boards and broker platforms, allowing you to automatically sync available loads into your system. This eliminates the need to manually browse multiple load boards and copy load information.

---

## Supported Providers

### 1. DAT (DAT One / DAT Power)
- **Largest load board in North America**
- **Subscription Tiers**: Standard, Enhanced, Pro, Select, Office
- **API Access**: Requires DAT API credentials
- **Features**: Market rate analytics, broker credit data, lane rate averages

### 2. Truckstop.com
- **Major load board with broker tools**
- **Subscription Tiers**: Basic, Advanced, Pro, Premium
- **API Access**: Requires Truckstop API credentials
- **Features**: Instant booking, broker credit insights, risk/compliance tools

### 3. 123Loadboard
- **Affordable alternative load board**
- **API Access**: Requires 123Loadboard API credentials
- **Features**: Aggregated loads from multiple sources

### 4. Other Providers
- **Custom Integration**: Support for other load board APIs
- **Configuration**: Custom API URL and credentials

---

## Integration Setup

### Prerequisites

1. **Active Subscription**: You must have an active subscription with the load board provider
2. **API Access**: Your subscription must include API access (not all tiers include this)
3. **API Credentials**: Obtain API key/secret from the provider's developer portal

### Setup Steps

1. **Navigate to Settings → Integrations**
2. **Select "External Load Boards"**
3. **Choose Provider** (DAT, Truckstop, 123Loadboard, or Other)
4. **Enter API Credentials**:
   - API Key
   - API Secret (if required)
   - Username/Password (if required)
5. **Configure Sync Settings**:
   - Enable auto-sync
   - Set sync interval (15, 30, or 60 minutes)
   - Set filters (origin, destination, equipment type)
   - Set max loads per sync
6. **Test Connection**
7. **Save Integration**

---

## Sync Configuration

### Auto-Sync Settings

- **Enable Auto-Sync**: Automatically sync loads at specified intervals
- **Sync Interval**: How often to check for new loads (15, 30, 60 minutes)
- **Max Loads Per Sync**: Limit number of loads fetched per sync (prevents overload)

### Sync Filters

Configure filters to only sync relevant loads:

- **Origin**: Filter by pickup location (city, state, or region)
- **Destination**: Filter by delivery location
- **Equipment Type**: Filter by required equipment (dry van, flatbed, etc.)
- **Rate Range**: Minimum and maximum rate
- **Distance Range**: Minimum and maximum distance

### Manual Sync

You can manually trigger a sync at any time:
1. Go to **External Loads** page
2. Click **"Sync Now"** button
3. View sync results in sync history

---

## External Loads Management

### Viewing External Loads

External loads are displayed in a dedicated **"External Loads"** page with:
- Load details (origin, destination, rate, equipment)
- Broker information (name, rating, payment terms)
- Sync source (DAT, Truckstop, etc.)
- Status (available, booked, expired, imported)

### Importing Loads

To import an external load into your internal load management:

1. **Browse External Loads** page
2. **Select Load** to import
3. **Click "Import Load"** button
4. **Review Load Details** (auto-filled from external load)
5. **Edit if Needed** (add driver, truck, route, etc.)
6. **Save Load**

The imported load will:
- Be created in your internal loads system
- Link back to the original external load
- Mark the external load as "imported"

### Load Status

- **Available**: Load is available and not yet imported
- **Booked**: Load has been booked (external board status)
- **Expired**: Load has expired on external board
- **Imported**: Load has been imported to internal system
- **Ignored**: Load has been marked as ignored (won't show in future syncs)

---

## API Integration Details

### DAT API

**Base URL**: `https://api.dat.com/v1`

**Authentication**: API Key + Secret (OAuth 2.0)

**Endpoints**:
- `GET /loads/search` - Search available loads
- `GET /loads/{id}` - Get load details
- `POST /loads/{id}/book` - Book a load
- `GET /brokers/{id}` - Get broker information

**Rate Limits**: Varies by subscription tier

### Truckstop API

**Base URL**: `https://api.truckstop.com/v1`

**Authentication**: API Key + Secret

**Endpoints**:
- `GET /loads` - Get available loads
- `GET /loads/{id}` - Get load details
- `POST /loads/{id}/book` - Book a load (if "Book It Now" available)
- `GET /brokers/{id}` - Get broker profile

**Rate Limits**: Varies by subscription tier

### 123Loadboard API

**Base URL**: `https://api.123loadboard.com/v1`

**Authentication**: API Key + Username/Password

**Endpoints**:
- `GET /loads` - Get available loads
- `GET /loads/{id}` - Get load details

---

## Sync History

All sync operations are logged in **Sync History** with:
- **Sync Type**: Manual, Automatic, or Scheduled
- **Status**: Success, Error, or Partial
- **Loads Found**: Number of loads found on external board
- **Loads Synced**: Number of loads successfully synced
- **Loads Updated**: Number of existing loads updated
- **Loads Skipped**: Number of loads skipped (duplicates, filters, etc.)
- **Errors**: Error count and details
- **Duration**: Time taken for sync

---

## Best Practices

### 1. Filter Configuration
- **Be Specific**: Use filters to only sync relevant loads
- **Avoid Overload**: Set reasonable max loads per sync
- **Update Filters**: Regularly review and update filters based on your needs

### 2. Sync Frequency
- **Start Conservative**: Begin with 60-minute intervals
- **Adjust Based on Volume**: Increase frequency if you need more loads
- **Monitor Performance**: Watch sync history for errors or performance issues

### 3. Load Management
- **Review Before Import**: Always review external loads before importing
- **Verify Broker Info**: Check broker ratings and payment terms
- **Update Load Details**: Add missing information after import

### 4. Error Handling
- **Monitor Sync History**: Check for sync errors regularly
- **Update Credentials**: If connection fails, verify API credentials
- **Contact Support**: If issues persist, contact TruckMates support

---

## Troubleshooting

### Connection Issues

**Problem**: "Connection test failed"
- **Solution**: Verify API credentials are correct
- **Solution**: Check that API access is enabled in your subscription
- **Solution**: Verify API key hasn't expired

### Sync Errors

**Problem**: "Sync failed" or "Partial sync"
- **Solution**: Check sync history for error details
- **Solution**: Verify API rate limits haven't been exceeded
- **Solution**: Check network connectivity

### Missing Loads

**Problem**: Expected loads not appearing
- **Solution**: Check sync filters (may be too restrictive)
- **Solution**: Verify loads match filter criteria
- **Solution**: Check if loads have expired on external board

### Import Issues

**Problem**: "Import failed"
- **Solution**: Verify all required fields are present
- **Solution**: Check for duplicate shipment numbers
- **Solution**: Ensure driver/truck assignments are valid

---

## Security & Privacy

- **Encrypted Credentials**: All API credentials are encrypted at rest
- **Secure API Calls**: All API calls use HTTPS
- **Access Control**: Only managers can configure integrations
- **Audit Trail**: All sync operations are logged

---

## Related Documentation

- [Marketplace Integration](./marketplace.md)
- [Load Management](../features/load-management.md)
- [API Documentation](../api/README.md)

---

## Support

For integration support:
- **Email**: support@truckmates.com
- **Documentation**: https://docs.truckmates.com/integrations
- **Status Page**: https://status.truckmates.com




