# Legacy Manager/Employee Logic – Where It’s Still Used

After moving to the **6-role system** (super_admin, operations_manager, dispatcher, safety_compliance, financial_controller, driver), several places still use the old **manager/employee** (or manager/user/driver) logic or raw role strings. Below is where that happens.

---

## 1. **Settings → Users (biggest gap)**

**File:** `app/dashboard/settings/users/page.tsx`

- **Display:** Roles are shown as **"Manager"**, **"Employee"**, **"Driver"** (lines 87, 132, 158).
- **Mapping:** `manager` → "Manager", `user` → "Employee", `driver` → "Driver" (lines 113–116, 132).
- **Dropdown:** Role change is only **"Manager" ↔ "Employee"** (lines 348, 424). No way to set the 6 roles (e.g. dispatcher, safety_compliance).
- **Invite:** Invite form likely still sends legacy role values.

**Impact:** Users can’t be assigned or shown as Operations Manager, Dispatcher, Safety & Compliance, or Financial Controller. The UI is effectively still a 2–3 role (Manager / Employee / Driver) model.

---

## 2. **Settings (main) – company update & profile**

**File:** `app/dashboard/settings/page.tsx`

- **Line 109:** `setIsManager(userResult.data.role === "manager")` – only the string `"manager"` is treated as manager.
- **Lines 139–140:** Only “managers” can update company info; uses that `isManager` (legacy).
- **Line 341:** Profile shows `userData.role === "manager" ? "Manager" : "Employee"` – binary Manager vs Employee.
- **Lines 220, 360:** Sections (e.g. company info, Add employee) are gated by `isManager`.

**Impact:** Anyone with a 6-role value (e.g. `operations_manager`, `dispatcher`) is not treated as a manager, so they can’t update company info or see manager-only sections, even if they should (e.g. operations_manager).

---

## 3. **Marketplace – role check**

**File:** `app/actions/marketplace.ts`

- **Lines 193, 287, 854:** `userData?.role !== "manager"` to block non-managers from posting/accepting loads and rating carriers.
- Uses raw DB `role` and only the string `"manager"`; no mapping and no 6-role or feature check.

**Impact:** Only users with `role === "manager"` in the DB can do these actions. Users with `operations_manager` (or other manager-like 6-roles) are blocked.

---

## 4. **Reminder settings – legacy role list**

**File:** `app/actions/settings-reminder.ts`

- **Lines 88–91:** `MANAGER_ROLES = ["manager", "admin", "owner"]`. No 6-role names and no `super_admin` / `operations_manager`.

**Impact:** Only legacy DB roles can update reminder settings. 6-role roles (e.g. operations_manager) are denied.

---

## 5. **ELD – create/update/sync (hardcoded roles)**

**File:** `app/actions/eld.ts`

- **Create device (lines 149–151):** `allowedRoles = ["super_admin", "operations_manager"]`, no `checkCreatePermission("eld")`.
- **Update device (lines 245–246):** Same hardcoded list, no `checkEditPermission("eld")`.
- **Sync (lines 602–604):** Same list, no shared permission helper.

**Impact:** Relies on raw `userData.role` and doesn’t use feature permissions or role mapping; delete was already switched to `checkDeletePermission("eld")`.

---

## 6. **Notifications (loads & routes) – legacy role filter**

**Files:** `app/actions/loads.ts` (line 44), `app/actions/routes.ts` (line 43)

- Filter for who gets notified: `"role.in.(dispatcher,manager,safety_manager,owner)"`.
- Uses old role names; no mapping and no 6-role names (e.g. `operations_manager`, `safety_compliance`).

**Impact:** Notifications may not reach the right people if the DB stores 6-role values or mapped roles.

---

## 7. **Routes – create route**

**File:** `app/actions/routes.ts`

- **Lines 176, 224–226:** `MANAGER_ROLES = ["super_admin", "operations_manager"]` and “Only managers can create routes”.
- Uses hardcoded manager list instead of e.g. `checkCreatePermission("routes")`.

**Impact:** Consistent with 6-role names but not with the rest of the permission system (feature-based). Dispatcher might be intended to create routes but has no way in via this check.

---

## 8. **Other “manager-only” checks (6-role names but hardcoded)**

These already use **6-role** names (`super_admin`, `operations_manager`) but still use a **hardcoded list** instead of feature permissions:

| File | What’s checked |
|------|----------------|
| `app/actions/settings-users.ts` | List/update/remove/invite/view/cancel: `MANAGER_ROLES = ["super_admin", "operations_manager"]` (lines 27, 80, 171, 251, 534, 577). |
| `app/actions/settings-portal.ts` | Portal settings: same pattern (lines 90–92). |
| `app/actions/settings-invoice-taxes.ts` | Create/update/delete invoice taxes: same (lines 94, 193, 275). |
| `app/actions/settings-integration.ts` | Integration settings + “isManager” (lines 137, 201–211). |
| `app/actions/settlement-pay-rules.ts` | Delete pay rules (lines 374–376). |

**Impact:** Logic is 6-role aware but duplicated and not aligned with a single feature-permission source (e.g. “settings” or “employees”).

---

## 9. **Dashboard layout & account setup**

**File:** `app/dashboard/layout-client.tsx`

- **Lines 123–125:** `user.role === "super_admin" || user.role === "operations_manager"` for account-setup redirect.
- Uses raw `user.role` from the client; no mapping. If DB stores legacy `manager`, they won’t be sent to manager setup.

---

## 10. **Supabase Edge Function**

**File:** `supabase/functions/analyze-eld-fault-codes/index.ts`

- **Lines 95–96:** `allowedRoles = ["manager", "admin", "owner", "super_admin", "operations_manager"]` – mix of legacy and 6-role.

**Impact:** Legacy roles still allowed; 6-role roles like dispatcher/safety_compliance are not explicitly allowed.

---

## 11. **Sidebar – “manager” for nav**

**File:** `components/dashboard/sidebar.tsx`

- **Lines 65, 120–122:** `isManager` is true only for `["super_admin", "operations_manager"]`.
- Used to show/hide nav items (e.g. Employees).

**Impact:** Aligned with 6-role “manager-like” roles; no change needed for 6-role consistency, but it’s another hardcoded list instead of something like `canViewFeature(role, "employees")`.

---

## 12. **Driver “employee_type”**

**Files:** `app/dashboard/drivers/add/page.tsx`, `app/dashboard/drivers/[id]/edit/page.tsx`, `app/actions/drivers.ts`

- **employee_type:** values like `"employee"` vs `"contractor"` (employment type for the driver), not the old user role “employee”.

**Impact:** This is not the legacy Manager/Employee role; it’s a separate concept. No change needed for 6-role migration.

---

## Summary

| Area | Issue | Suggested direction |
|------|--------|---------------------|
| **Settings → Users UI** | Only Manager/Employee/Driver; no 6-role assign or display | Add 6-role dropdown and map DB role ↔ display; invite with 6-role. |
| **Settings (main)** | `role === "manager"` for isManager and profile | Use mapped role + feature or “can manage company” (e.g. operations_manager, super_admin). |
| **Marketplace** | `role !== "manager"` | Use mapped role or checkCreatePermission / feature for “marketplace” or “loads”. |
| **settings-reminder** | `["manager", "admin", "owner"]` | Use 6-role manager list or checkEditPermission("settings"/“reminders”). |
| **ELD create/update/sync** | Hardcoded allowedRoles | Use checkCreatePermission/checkEditPermission("eld") and shared role from getUserRole(). |
| **Loads/routes notifications** | Legacy role filter | Use 6-role names or a “notify these roles” list derived from feature roles. |
| **Routes create** | Hardcoded MANAGER_ROLES | Use checkCreatePermission("routes"). |
| **Other settings/settings-users** | Hardcoded MANAGER_ROLES | Consider checkEditPermission("settings") or “employees” where relevant. |
| **Layout account-setup** | Raw user.role | Use mapped role (e.g. from getUserRole()) so legacy “manager” is treated as operations_manager/super_admin. |
| **Edge function ELD** | Mixed legacy + 6-role | Use 6-role list + mapLegacyRole or equivalent so all manager-like roles are allowed. |

If you tell me which area you want to tackle first (e.g. “Settings → Users” or “Marketplace”), I can outline exact code changes and patches for that part.
