# Subscription plan naming (billing alignment)

## Canonical plan names

Use these **exactly** everywhere (DB, Stripe metadata, PayPal custom_id, UI):

| Internal `name` (lowercase) | Display name | Notes |
|-----------------------------|--------------|--------|
| `free` | Free (legacy/default) | Kept for backward compatibility |
| `starter` | Operator | Strategy-tier mapping |
| `professional` | Fleet | Strategy-tier mapping |
| `enterprise` | Enterprise | Strategy-tier mapping |

**Do not use:** `simple`, `standard`, `premium`, `basic`, or any other variants. Billing and plan limits rely on these four names.

## Tables

- **`subscription_plans`** – Master list of plans. `name` is UNIQUE and canonical (free, starter, professional, enterprise). Limit checks (max_users, max_drivers, max_vehicles) use this table.
- **`subscriptions`** – One row per company; `plan_id` FK → `subscription_plans.id`. Populated by Stripe/PayPal webhooks. This is the source of truth for **enforcing limits** (drivers, trucks, users).
- **`company_subscriptions`** – Legacy/billing UI table; `plan_name` is TEXT. When writing to this table, `plan_name` **must** match `subscription_plans.name` (free, starter, professional, enterprise) so display and any future sync stay consistent.

## Webhooks

- **Stripe:** Pass `plan_id` (subscription_plans.id UUID) in checkout/session metadata. Webhook upserts `subscriptions` with that `plan_id`.
- **PayPal:** Store our internal `plan_id` (subscription_plans.id) in subscription `custom_id` when creating the subscription so the webhook can map PayPal’s plan_id to our plan and upsert `subscriptions` correctly.

## Limit enforcement

- **Enforced today:** `drivers.ts` (max_drivers), `trucks.ts` (max_vehicles), `settings-users.ts` (max_users) read limits from `subscriptions` JOIN `subscription_plans`. Ensure Stripe/PayPal webhooks always set `plan_id` so these checks work.
- **Not in schema:** `subscription_plans` has no `max_loads` or `max_routes`. If you add them later, add the same pattern in `loads.ts` and `routes.ts` create actions.

## Six-role RBAC vs subscription tier (product decision)

The platform uses a **single six-role model** in Settings → Users and server actions: `super_admin`, `operations_manager`, `dispatcher`, `safety_compliance`, `financial_controller`, `driver` (see `lib/roles.ts`).

**Stakeholder clarification (strategy doc correction):** six-role access must **not** be positioned as Enterprise-only. **Fleet** tier (in strategy naming) includes full six-role access on the plan list. In this codebase, **Fleet maps to the `professional` plan** until billing/UI renames tiers to Operator / Fleet / Enterprise.

- **Included on Fleet (`professional`) and Enterprise (`enterprise`)** in `subscription_plans.features` and public pricing copy.
- **Enterprise-only** stays reserved for items such as **multi-company RBAC**, audit logs, white-label portal, etc.—not the base six roles.

Do **not** gate assignment of the six roles by plan in application code unless product later adds an explicit exception (none as of this note).

The app does **not** gate which of the six roles you can assign by subscription tier today; limits are **seat counts** (`max_users`), not role types. Enterprise differentiators stay items such as **multi-company RBAC**, audit logs, and white-label portal — not the base six roles.
