# TruckMates Authentication System

## Overview

A clean, professional authentication system built from scratch with proper JSON serialization and error handling.

## Architecture

### Database Schema
- **`public.users`**: Extends Supabase `auth.users`, stores user profile and company link
- **`public.companies`**: Company information with optional `company_type` for marketplace
- **Trigger**: Auto-creates `public.users` record when `auth.users` is created
- **RLS Policies**: Company-scoped data isolation

### Authentication Flow

1. **Super Admin Registration** (`/register/super-admin`)
   - Creates auth user
   - Creates company
   - Links user to company
   - Sets role = `super_admin`

2. **Employee Registration** (`/register/employee`)
   - Creates auth user
   - Optionally links to company (via companyId)
   - Sets appropriate role

3. **Login** (`/login`)
   - Standard email/password authentication
   - Routes to appropriate dashboard based on company type

## Files Created

### Core Authentication
- `lib/auth/server.ts` - Server-side auth helpers (getCurrentUser, getAuthContext)
- `app/actions/auth.ts` - Authentication server actions (register, checkCompanyName)
- `middleware.ts` - Route protection middleware

### Pages
- `app/login/page.tsx` - Login page
- `app/register/page.tsx` - Registration type selection
- `app/register/super-admin/page.tsx` - Company owner registration
- `app/register/employee/page.tsx` - Employee registration

### Database
- `supabase/auth_schema.sql` - Complete authentication schema setup

## Key Features

✅ **JSON Serializable**: All return values are plain objects with only primitives
✅ **Error Handling**: Comprehensive error handling with user-friendly messages
✅ **Company Isolation**: RLS policies ensure data isolation
✅ **Role-Based**: Supports 6 role types (super_admin, operations_manager, dispatcher, etc.)
✅ **Marketplace Support**: Company types (broker, carrier, both) for marketplace features

## Usage

### Get Current User
```typescript
import { getCurrentUser } from "@/lib/auth/server"

const result = await getCurrentUser()
if (result.data) {
  const user = result.data
  // user.id, user.email, user.role, user.company_id, etc.
}
```

### Get Auth Context
```typescript
import { getAuthContext } from "@/lib/auth/server"

const { user, companyId, error } = await getAuthContext()
```

### Register Super Admin
```typescript
import { registerSuperAdmin } from "@/app/actions/auth"

const result = await registerSuperAdmin({
  companyName: "My Company",
  email: "admin@company.com",
  phone: "+1234567890",
  password: "securepassword",
  companyType: "broker" // optional
})
```

## Database Setup

Run `supabase/auth_schema.sql` in Supabase SQL Editor to set up:
- Users and companies tables
- Trigger for auto-creating user records
- RLS policies for security
- Indexes for performance


