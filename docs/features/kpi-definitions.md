# KPI Definitions
TruckMates Platform Key Performance Indicators

## Overview

TruckMates tracks various Key Performance Indicators (KPIs) to help you measure and improve your fleet operations. This document defines all KPIs used in the platform.

---

## Fleet Performance KPIs

### Active Trucks
**Definition**: Number of trucks currently in active service (not inactive, sold, or retired)
**Calculation**: Count of trucks with status = 'active'
**Update Frequency**: Real-time
**Location**: Dashboard, Fleet Analytics

### Active Drivers
**Definition**: Number of drivers currently available and active
**Calculation**: Count of drivers with status = 'active'
**Update Frequency**: Real-time
**Location**: Dashboard, Driver Analytics

### Total Loads
**Definition**: Total number of loads in the system (all statuses)
**Calculation**: Count of all loads
**Update Frequency**: Real-time
**Location**: Dashboard, Load Analytics

### Active Loads
**Definition**: Loads currently in transit or assigned
**Calculation**: Count of loads with status IN ('assigned', 'in_transit', 'picked_up')
**Update Frequency**: Real-time
**Location**: Dashboard, Load Analytics

### Completed Loads
**Definition**: Loads that have been delivered
**Calculation**: Count of loads with status = 'delivered'
**Update Frequency**: Real-time
**Location**: Dashboard, Load Analytics

---

## Financial KPIs

### Total Revenue
**Definition**: Sum of all invoice amounts (paid and unpaid)
**Calculation**: SUM(invoices.amount) WHERE status IN ('sent', 'paid')
**Update Frequency**: Real-time
**Location**: Dashboard, Accounting Reports

### Average Revenue Per Load
**Definition**: Average revenue generated per completed load
**Calculation**: Total Revenue / Completed Loads
**Update Frequency**: Real-time
**Location**: Dashboard, Analytics

### On-Time Delivery Rate
**Definition**: Percentage of loads delivered on or before scheduled delivery date
**Calculation**: (On-time deliveries / Total deliveries) × 100
**Update Frequency**: Real-time
**Location**: Dashboard, Analytics

### Profit Margin
**Definition**: Net profit as percentage of revenue
**Calculation**: ((Revenue - Expenses) / Revenue) × 100
**Update Frequency**: Real-time
**Location**: P&L Reports

---

## Operational KPIs

### Fleet Utilization
**Definition**: Percentage of trucks actively assigned to loads
**Calculation**: (Trucks with active loads / Total active trucks) × 100
**Update Frequency**: Real-time
**Location**: Fleet Analytics

### Driver Utilization
**Definition**: Percentage of drivers actively assigned to loads
**Calculation**: (Drivers with active loads / Total active drivers) × 100
**Update Frequency**: Real-time
**Location**: Driver Analytics

### Average Load Time
**Definition**: Average time from load assignment to delivery
**Calculation**: AVG(delivery_date - assignment_date)
**Update Frequency**: Daily
**Location**: Load Analytics

### Route Efficiency
**Definition**: Actual miles vs. planned miles
**Calculation**: (Planned miles / Actual miles) × 100
**Update Frequency**: After route completion
**Location**: Route Analytics

---

## Compliance KPIs

### HOS Violation Rate
**Definition**: Number of HOS violations per 100 driving hours
**Calculation**: (Total violations / Total driving hours) × 100
**Update Frequency**: Real-time
**Location**: ELD Dashboard, Driver Scorecard

### Compliance Score
**Definition**: Overall compliance rating (0-100)
**Calculation**: Based on violations, inspections, and documentation
**Components**:
- Violation Score (0-50 points): Fewer violations = higher score
- Compliance Score (0-30 points): Based on documentation and inspections
- Safety Score (0-20 points): Based on safety events
**Update Frequency**: Daily
**Location**: Driver Scorecard, ELD Insights

### Driver Behavior Score
**Definition**: Overall driver performance rating (0-100)
**Calculation**: Composite score based on:
- Violations per 100 hours
- On-time delivery rate
- Safety events
- Customer feedback
**Update Frequency**: Daily
**Location**: Driver Scorecard

---

## Maintenance KPIs

### Maintenance Cost Per Mile
**Definition**: Average maintenance cost per mile driven
**Calculation**: Total maintenance costs / Total miles driven
**Update Frequency**: Monthly
**Location**: Maintenance Analytics

### Preventive Maintenance Compliance
**Definition**: Percentage of scheduled maintenance completed on time
**Calculation**: (On-time maintenance / Total scheduled) × 100
**Update Frequency**: Real-time
**Location**: Maintenance Dashboard

### Vehicle Downtime
**Definition**: Average days vehicles are out of service for maintenance
**Calculation**: AVG(repair_end_date - repair_start_date)
**Update Frequency**: Real-time
**Location**: Maintenance Analytics

---

## Fuel & Cost KPIs

### Fuel Efficiency (MPG)
**Definition**: Average miles per gallon across fleet
**Calculation**: Total miles / Total gallons
**Update Frequency**: Real-time
**Location**: Fuel Analytics

### Fuel Cost Per Mile
**Definition**: Average fuel cost per mile
**Calculation**: Total fuel costs / Total miles
**Update Frequency**: Real-time
**Location**: Fuel Analytics

### Cost Per Load
**Definition**: Average total cost per completed load
**Calculation**: (Fuel + Maintenance + Driver Pay) / Completed Loads
**Update Frequency**: Real-time
**Location**: Financial Reports

---

## Export Formats

All KPIs can be exported in the following formats:
- **CSV**: For Excel and spreadsheet analysis
- **JSON**: For API integration and custom reporting
- **PDF**: For reports and documentation
- **Excel**: Formatted Excel files with charts

---

## KPI Calculation Methodology

### Real-Time KPIs
- Calculated on-demand when dashboard loads
- Cached for 5 minutes to improve performance
- Automatically refreshed when data changes

### Historical KPIs
- Calculated daily at midnight (UTC)
- Stored in analytics tables for trend analysis
- Available for date range queries

### Aggregated KPIs
- Calculated from raw data using SQL aggregations
- Supports filtering by date range, driver, truck, route
- Can be grouped by day, week, month, quarter, year

---

## KPI Benchmarks

### Industry Standards
- **Fleet Utilization**: 85-95% (target)
- **On-Time Delivery**: 95%+ (target)
- **HOS Violation Rate**: < 1 per 100 hours (target)
- **Fuel Efficiency**: 6-8 MPG (varies by truck type)
- **Maintenance Cost**: $0.10-$0.15 per mile (target)

### TruckMates Averages
- **Fleet Utilization**: 78% (platform average)
- **On-Time Delivery**: 92% (platform average)
- **HOS Violation Rate**: 0.8 per 100 hours (platform average)
- **Fuel Efficiency**: 7.2 MPG (platform average)

---

## Custom KPIs

TruckMates supports custom KPI definitions through:
- **Custom Reports**: Define your own calculations
- **API Access**: Build custom dashboards with KPI data
- **Export & Analysis**: Export data for external analysis tools

---

## Related Documentation

- [Analytics Features](../features/analytics.md)
- [Reports Documentation](../reports/README.md)
- [API Documentation](../api/README.md)




