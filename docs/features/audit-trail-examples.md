# Audit Trail Examples
TruckMates Platform - Audit Trail Capabilities and Examples

## Overview

TruckMates maintains comprehensive audit trails for all critical operations, providing complete transparency and compliance tracking. This document provides examples of audit trail data and use cases.

---

## What is an Audit Trail?

An audit trail is a chronological record of all activities, changes, and events in the system. It includes:
- **Who**: User who performed the action
- **What**: Action performed
- **When**: Timestamp of the action
- **Where**: Entity/record affected
- **Why**: Reason or context (if provided)
- **How**: Method or source of the change

---

## Audit Trail Examples

### 1. Load Status Changes

**Example: Load Status Updated**

```json
{
  "id": "audit-123",
  "entity_type": "load",
  "entity_id": "load-456",
  "action": "status_updated",
  "user_id": "user-789",
  "user_name": "John Manager",
  "company_id": "company-001",
  "timestamp": "2025-01-15T10:30:00Z",
  "changes": {
    "field": "status",
    "old_value": "assigned",
    "new_value": "in_transit",
    "reason": "Driver started route"
  },
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "source": "web_dashboard"
  }
}
```

**Use Case**: Track when loads change status, who authorized the change, and why.

---

### 2. Driver Information Updates

**Example: Driver License Updated**

```json
{
  "id": "audit-124",
  "entity_type": "driver",
  "entity_id": "driver-321",
  "action": "license_updated",
  "user_id": "user-789",
  "user_name": "John Manager",
  "company_id": "company-001",
  "timestamp": "2025-01-15T14:20:00Z",
  "changes": {
    "field": "license_expiry",
    "old_value": "2025-03-15",
    "new_value": "2026-03-15",
    "reason": "License renewed"
  },
  "document_uploaded": {
    "document_id": "doc-555",
    "document_type": "license",
    "file_name": "cdl_renewal_2026.pdf"
  },
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "source": "web_dashboard"
  }
}
```

**Use Case**: Compliance tracking for driver license renewals and updates.

---

### 3. HOS Violation Resolution

**Example: Violation Acknowledged and Resolved**

```json
{
  "id": "audit-125",
  "entity_type": "eld_violation",
  "entity_id": "violation-888",
  "action": "violation_resolved",
  "user_id": "user-789",
  "user_name": "John Manager",
  "company_id": "company-001",
  "timestamp": "2025-01-15T16:45:00Z",
  "changes": {
    "field": "status",
    "old_value": "pending",
    "new_value": "resolved",
    "resolution_notes": "Driver took required 30-minute break. Violation resolved."
  },
  "violation_details": {
    "violation_type": "break_required",
    "driver_id": "driver-321",
    "driver_name": "Mike Driver",
    "violation_time": "2025-01-15T15:30:00Z",
    "severity": "warning"
  },
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "source": "web_dashboard"
  }
}
```

**Use Case**: DOT compliance tracking for HOS violations and resolutions.

---

### 4. Invoice Creation and Updates

**Example: Invoice Created and Sent**

```json
{
  "id": "audit-126",
  "entity_type": "invoice",
  "entity_id": "invoice-999",
  "action": "invoice_created",
  "user_id": "system",
  "user_name": "Auto-Invoice System",
  "company_id": "company-001",
  "timestamp": "2025-01-15T18:00:00Z",
  "changes": {
    "action": "created",
    "invoice_number": "INV-2025-001",
    "amount": 5000.00,
    "customer": "ABC Logistics Inc.",
    "load_id": "load-456"
  },
  "metadata": {
    "source": "auto_generation",
    "trigger": "load_delivered"
  }
}
```

**Follow-up Audit Entry: Invoice Sent**

```json
{
  "id": "audit-127",
  "entity_type": "invoice",
  "entity_id": "invoice-999",
  "action": "invoice_sent",
  "user_id": "user-789",
  "user_name": "John Manager",
  "company_id": "company-001",
  "timestamp": "2025-01-15T18:05:00Z",
  "changes": {
    "field": "status",
    "old_value": "draft",
    "new_value": "sent",
    "sent_to": "billing@abclogistics.com",
    "sent_method": "email"
  },
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "source": "web_dashboard"
  }
}
```

**Use Case**: Financial audit trail for invoice creation, sending, and payment tracking.

---

### 5. Route Optimization

**Example: Route Optimized**

```json
{
  "id": "audit-128",
  "entity_type": "route",
  "entity_id": "route-777",
  "action": "route_optimized",
  "user_id": "user-789",
  "user_name": "John Manager",
  "company_id": "company-001",
  "timestamp": "2025-01-15T09:15:00Z",
  "changes": {
    "action": "optimized",
    "optimization_algorithm": "nearest_neighbor",
    "stops_before": 5,
    "stops_after": 5,
    "distance_before": 450.5,
    "distance_after": 380.2,
    "time_saved_minutes": 45,
    "fuel_saved_gallons": 12.5
  },
  "optimization_details": {
    "constraints": ["hos", "weight", "height"],
    "traffic_data_used": true,
    "fuel_cost_considered": true,
    "toll_cost_considered": true
  },
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "source": "web_dashboard"
  }
}
```

**Use Case**: Track route optimization decisions and their impact on efficiency.

---

### 6. Document Upload and Analysis

**Example: Document Uploaded and Analyzed**

```json
{
  "id": "audit-129",
  "entity_type": "document",
  "entity_id": "doc-444",
  "action": "document_uploaded",
  "user_id": "user-789",
  "user_name": "John Manager",
  "company_id": "company-001",
  "timestamp": "2025-01-15T11:00:00Z",
  "changes": {
    "action": "uploaded",
    "document_type": "invoice",
    "file_name": "supplier_invoice_jan_2025.pdf",
    "file_size": 245678,
    "analysis_status": "pending"
  },
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "source": "web_dashboard"
  }
}
```

**Follow-up Audit Entry: Document Analyzed**

```json
{
  "id": "audit-130",
  "entity_type": "document",
  "entity_id": "doc-444",
  "action": "document_analyzed",
  "user_id": "system",
  "user_name": "AI Analysis System",
  "company_id": "company-001",
  "timestamp": "2025-01-15T11:02:00Z",
  "changes": {
    "action": "analyzed",
    "analysis_method": "openai_vision",
    "extracted_data": {
      "type": "invoice",
      "vendor": "ABC Parts Supply",
      "amount": 1250.00,
      "date": "2025-01-10",
      "invoice_number": "INV-ABC-2025-001"
    },
    "confidence_score": 0.95,
    "auto_created_record": {
      "record_type": "expense",
      "record_id": "expense-333"
    }
  },
  "metadata": {
    "source": "ai_analysis",
    "processing_time_seconds": 3.5
  }
}
```

**Use Case**: Track document processing and AI analysis results.

---

### 7. User Access and Permissions

**Example: User Role Changed**

```json
{
  "id": "audit-131",
  "entity_type": "user",
  "entity_id": "user-111",
  "action": "role_updated",
  "user_id": "user-789",
  "user_name": "John Manager",
  "company_id": "company-001",
  "timestamp": "2025-01-15T13:30:00Z",
  "changes": {
    "field": "role",
    "old_value": "employee",
    "new_value": "manager",
    "reason": "Promoted to dispatcher manager"
  },
  "permissions_changed": {
    "added": ["manage_loads", "manage_drivers", "view_reports"],
    "removed": []
  },
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "source": "web_dashboard"
  }
}
```

**Use Case**: Security audit trail for user access and permission changes.

---

### 8. Maintenance Service Completion

**Example: Maintenance Service Completed**

```json
{
  "id": "audit-132",
  "entity_type": "maintenance",
  "entity_id": "maint-222",
  "action": "service_completed",
  "user_id": "user-789",
  "user_name": "John Manager",
  "company_id": "company-001",
  "timestamp": "2025-01-15T17:00:00Z",
  "changes": {
    "field": "status",
    "old_value": "in_progress",
    "new_value": "completed",
    "actual_cost": 450.00,
    "estimated_cost": 400.00,
    "service_notes": "Oil change and tire rotation completed. All systems normal."
  },
  "service_details": {
    "service_type": "preventive",
    "vehicle_id": "truck-555",
    "vendor": "Quick Lube Service",
    "parts_used": ["oil_filter", "engine_oil_5w30"],
    "labor_hours": 1.5,
    "mileage_at_service": 45000
  },
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "source": "web_dashboard"
  }
}
```

**Use Case**: Track maintenance service completion and costs.

---

## Audit Trail Features

### 1. Immutable Records
- Audit trail entries cannot be modified or deleted
- Ensures data integrity and compliance

### 2. Complete History
- All changes tracked from creation to deletion
- Full chronological record of all activities

### 3. Searchable
- Search by entity type, user, date range, action type
- Filter by company, department, or specific records

### 4. Exportable
- Export audit trails for compliance reporting
- Formats: CSV, JSON, PDF
- Date range filtering

### 5. Real-Time Monitoring
- Real-time audit trail updates
- Alerts for critical actions
- Dashboard for audit activity

---

## Compliance Use Cases

### DOT Compliance
- **HOS Violations**: Track all violations and resolutions
- **Driver Records**: Complete history of driver information changes
- **Vehicle Records**: Maintenance and inspection history

### Financial Compliance
- **Invoice Tracking**: Complete invoice lifecycle
- **Payment Records**: All payment transactions
- **Expense Tracking**: Expense creation and approval

### Security Compliance
- **User Access**: All login attempts and access changes
- **Permission Changes**: Role and permission modifications
- **Data Access**: Who accessed what data and when

---

## Audit Trail Reports

### Standard Reports
1. **User Activity Report**: All actions by a specific user
2. **Entity Change Report**: All changes to a specific record
3. **Compliance Report**: All compliance-related activities
4. **Security Report**: All security-related activities

### Custom Reports
- Date range filtering
- Entity type filtering
- Action type filtering
- User filtering
- Company filtering

---

## Related Documentation

- [Security Overview](../security.md)
- [Compliance Documentation](../compliance.md)
- [User Management](../features/user-management.md)
- [Data Privacy](../privacy.md)




