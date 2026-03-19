# Dashboard route alias inventory

Single reference for canonical form routes and redirect aliases. Use **Canonical** URLs in new links; **Alias** routes redirect to canonical so old links and bookmarks still work.

---

## Summary

| Module | Canonical (use this) | Alias (redirects to canonical) |
|--------|----------------------|--------------------------------|
| Drivers | `/dashboard/drivers/add` | `/dashboard/drivers/create` |
| Trucks | `/dashboard/trucks/add` | `/dashboard/trucks/create` |
| Loads | `/dashboard/loads/add` | `/dashboard/loads/create` |
| Routes | `/dashboard/routes/add` | `/dashboard/routes/create` |
| Customers | `/dashboard/customers/add` | `/dashboard/customers/create` |
| Vendors | `/dashboard/vendors/add` | `/dashboard/vendors/create` |
| Maintenance | `/dashboard/maintenance/add` | `/dashboard/maintenance/create` |
| Expenses | `/dashboard/accounting/expenses/add` | `/dashboard/accounting/expenses/create` |
| DVIR | `/dashboard/dvir/add` | `/dashboard/dvir/new`, `/dashboard/dvir/create` |
| Geofencing | `/dashboard/geofencing/add` | `/dashboard/geofencing/create` |
| IFTA | `/dashboard/ifta/generate` | `/dashboard/ifta/create` |
| ELD Logs | `/dashboard/eld/logs/add` | `/dashboard/eld/logs/create` |
| ELD Locations | `/dashboard/eld/locations/add` | `/dashboard/eld/locations/create` |
| ELD Violations | `/dashboard/eld/violations/add` | `/dashboard/eld/violations/create` |
| Invoices | `/dashboard/accounting/invoices/create` | — (canonical is create) |
| Settlements | `/dashboard/accounting/settlements/create` | — (canonical is create) |
| BOLs | `/dashboard/bols/create` | — (canonical is create) |

---

## Canonical routes (real form pages)

Use these paths in `<Link href="...">`, `router.push()`, and `router.replace()`.

| Route | Purpose |
|-------|---------|
| `/dashboard/drivers/add` | Add driver |
| `/dashboard/trucks/add` | Add truck |
| `/dashboard/loads/add` | Add load |
| `/dashboard/routes/add` | Add route |
| `/dashboard/customers/add` | Add customer |
| `/dashboard/vendors/add` | Add vendor |
| `/dashboard/maintenance/add` | Add maintenance record |
| `/dashboard/accounting/expenses/add` | Add expense |
| `/dashboard/dvir/add` | Create DVIR |
| `/dashboard/geofencing/add` | Create geofence zone |
| `/dashboard/ifta/generate` | Generate IFTA report |
| `/dashboard/eld/logs/add` | Add HOS log entry |
| `/dashboard/eld/locations/add` | Add ELD location |
| `/dashboard/eld/violations/add` | Add ELD event/violation |
| `/dashboard/accounting/invoices/create` | Create invoice |
| `/dashboard/accounting/settlements/create` | Create settlement |
| `/dashboard/bols/create` | Create BOL |

---

## Alias routes (redirect-only)

These paths exist only to redirect. Implementation: `redirect("/dashboard/...")` in a minimal `page.tsx`.

| Alias | Redirects to |
|-------|----------------|
| `/dashboard/drivers/create` | `/dashboard/drivers/add` |
| `/dashboard/trucks/create` | `/dashboard/trucks/add` |
| `/dashboard/loads/create` | `/dashboard/loads/add` |
| `/dashboard/routes/create` | `/dashboard/routes/add` |
| `/dashboard/customers/create` | `/dashboard/customers/add` |
| `/dashboard/vendors/create` | `/dashboard/vendors/add` |
| `/dashboard/maintenance/create` | `/dashboard/maintenance/add` |
| `/dashboard/accounting/expenses/create` | `/dashboard/accounting/expenses/add` |
| `/dashboard/dvir/new` | `/dashboard/dvir/add` |
| `/dashboard/dvir/create` | `/dashboard/dvir/add` |
| `/dashboard/geofencing/create` | `/dashboard/geofencing/add` |
| `/dashboard/ifta/create` | `/dashboard/ifta/generate` |
| `/dashboard/eld/logs/create` | `/dashboard/eld/logs/add` |
| `/dashboard/eld/locations/create` | `/dashboard/eld/locations/add` |
| `/dashboard/eld/violations/create` | `/dashboard/eld/violations/add` |

---

## File locations

- **Redirect pages**: `app/dashboard/<module>/create/page.tsx` or `app/dashboard/dvir/new/page.tsx` — each exports a default component that calls `redirect("...")`.
- **Canonical form pages**: `app/dashboard/<module>/add/page.tsx` or `.../create/page.tsx` (invoices, settlements, BOLs) or `.../generate/page.tsx` (IFTA).

---

*Last updated from route alias and form-pattern cleanup. Use canonical URLs for new features.*
