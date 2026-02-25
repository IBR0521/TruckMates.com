# User Journey: Account Setup Flow by Role

## 🎯 Overview

This document explains how the account setup flow works from a **user's perspective** after registration, and how it **changes based on the role** you choose.

---

## 📋 Available Roles

There are **6 roles** in TruckMates:

1. **Super Admin** - Company owner, full control
2. **Operations Manager** - Lead dispatcher, marketplace focus
3. **Dispatcher** - Real-time execution, active loads
4. **Safety & Compliance Officer** - ELD service, inspections
5. **Financial Controller** - Invoicing, settlements, IFTA
6. **Driver** - Mobile task completion, ELD logs

---

## 🔄 User Journey by Role

### **Scenario 1: Super Admin (Company Owner)**

#### **Step 1: Registration**
1. Go to `/register`
2. Click "Super Admin" card
3. Fill out form:
   - Company Name (required)
   - Email (required)
   - Phone (required)
   - Password (required)
   - Company Type: Broker / Carrier / Both / Regular (optional)
4. Click "Create Account"

#### **What Happens Behind the Scenes:**
- ✅ Creates your user account
- ✅ Creates a new company with your company name
- ✅ Links you to that company automatically
- ✅ Sets your role to `super_admin`
- ✅ You become the company owner

#### **Step 2: After Registration**
**Current Behavior:**
- Redirects to `/account-setup/manager`
- Page shows "Welcome to TruckMates!"
- **Immediately redirects to `/dashboard`** (no actual setup)

**What SHOULD Happen (After Implementation):**
- Redirects to `/account-setup/manager`
- **Account Setup Wizard appears** with 5 steps:
  1. Complete Company Information (address, phone, business details)
  2. Add First Driver (optional - can skip)
  3. Add First Truck (optional - can skip)
  4. Import Demo Data? (Yes/No)
  5. Complete & Welcome
- After completing, redirects to dashboard

#### **Step 3: Dashboard Access**
- ✅ You can access dashboard immediately
- ✅ You have full control over your company
- ✅ You can add drivers, trucks, loads, etc.
- ✅ All features are available to you

#### **Account Setup Flow Behavior:**
- **MANDATORY** - You must complete company setup
- Dashboard will redirect you back to setup if incomplete (after implementation)
- Only Super Admin sees the full setup wizard
- You're setting up YOUR company

---

### **Scenario 2: Operations Manager / Dispatcher / Safety & Compliance / Financial Controller**

#### **Step 1: Registration**
1. Go to `/register`
2. Click your role card (e.g., "Operations Manager")
3. Fill out form:
   - Full Name (required)
   - Email (required)
   - Password (required)
   - Role (pre-selected based on card you clicked)
   - Company ID (optional - if you have an invitation)
4. Click "Create Account"

#### **What Happens Behind the Scenes:**
- ✅ Creates your user account
- ✅ Sets your role (e.g., `operations_manager`)
- ✅ **Optionally links you to a company** (if you provided Company ID)
- ❌ **Does NOT create a company** (you join an existing one)

#### **Step 2: After Registration**
**Current Behavior:**
- Redirects directly to `/dashboard`
- **No account setup flow** (you're not a company owner)

**What Happens:**
- If you provided a Company ID:
  - ✅ You're linked to that company
  - ✅ You can access company data
  - ✅ You see company dashboard
- If you did NOT provide a Company ID:
  - ⚠️ You're registered but not linked to any company
  - ⚠️ Dashboard layout checks for `company_id`
  - ⚠️ Currently: TODO comment (no redirect implemented)
  - ⚠️ You might see limited/empty dashboard

#### **Step 3: Dashboard Access**
- ✅ If linked to company: Full access to company data
- ⚠️ If not linked: Limited access (depends on implementation)
- ✅ Your role determines which features you see
- ✅ Feature access is filtered by your role

#### **Account Setup Flow Behavior:**
- **NO SETUP WIZARD** - You don't get the account setup flow
- You're joining an existing company, not creating one
- If you need to be added to a company, Super Admin must invite you
- You might need to wait for company invitation

---

### **Scenario 3: Driver**

#### **Step 1: Registration**
1. Go to `/register`
2. Click "Driver" card
3. Fill out form:
   - Full Name (required)
   - Email (required)
   - Password (required)
   - Role: Driver (pre-selected)
   - Company ID (optional - if you have an invitation)
4. Click "Create Account"

#### **What Happens Behind the Scenes:**
- ✅ Creates your user account
- ✅ Sets your role to `driver`
- ✅ **Optionally links you to a company** (if you provided Company ID)
- ❌ **Does NOT create a company**
- ✅ Can work standalone (doesn't require company)

#### **Step 2: After Registration**
**Current Behavior:**
- Redirects directly to `/dashboard`
- **No account setup flow**

**What Happens:**
- If you provided a Company ID:
  - ✅ You're linked to that company
  - ✅ You see company-assigned loads
  - ✅ You can upload PODs, manage ELD logs
- If you did NOT provide a Company ID:
  - ✅ You can still use the platform
  - ✅ You work as an independent driver
  - ✅ You can manage your own ELD logs
  - ✅ You can view marketplace loads (if implemented)

#### **Step 3: Dashboard Access**
- ✅ Mobile-focused dashboard
- ✅ View assigned loads
- ✅ Manage ELD logs
- ✅ Upload PODs
- ✅ Personal HOS tracking

#### **Account Setup Flow Behavior:**
- **NO SETUP WIZARD** - Drivers don't get account setup flow
- Drivers can work independently or join a company
- If joining a company, they need Company ID or invitation

---

## 🔍 Key Differences by Role

### **Super Admin:**
- ✅ **Creates company** during registration
- ✅ **Gets account setup wizard** (after implementation)
- ✅ **Mandatory setup** - must complete company profile
- ✅ **Full control** - can manage everything
- ✅ **Company owner** - responsible for company setup

### **Operations Manager / Dispatcher / Safety / Financial:**
- ❌ **Does NOT create company**
- ❌ **No account setup wizard**
- ✅ **Joins existing company** (optional)
- ✅ **Role-based features** - see features based on role
- ⚠️ **May need invitation** if no Company ID provided

### **Driver:**
- ❌ **Does NOT create company**
- ❌ **No account setup wizard**
- ✅ **Can work standalone** (doesn't require company)
- ✅ **Can join company** (optional)
- ✅ **Mobile-focused** dashboard

---

## 📊 Current vs. Planned Behavior

### **Current Implementation:**

| Role | Creates Company? | Setup Wizard? | Redirect After Reg |
|------|-----------------|---------------|-------------------|
| Super Admin | ✅ Yes | ❌ No (just redirects) | `/account-setup/manager` → `/dashboard` |
| Operations Manager | ❌ No | ❌ No | `/dashboard` |
| Dispatcher | ❌ No | ❌ No | `/dashboard` |
| Safety & Compliance | ❌ No | ❌ No | `/dashboard` |
| Financial Controller | ❌ No | ❌ No | `/dashboard` |
| Driver | ❌ No | ❌ No | `/dashboard` |

### **After Implementation:**

| Role | Creates Company? | Setup Wizard? | Redirect After Reg |
|------|-----------------|---------------|-------------------|
| Super Admin | ✅ Yes | ✅ Yes (5 steps) | `/account-setup/manager` → Complete → `/dashboard` |
| Operations Manager | ❌ No | ❌ No | `/dashboard` |
| Dispatcher | ❌ No | ❌ No | `/dashboard` |
| Safety & Compliance | ❌ No | ❌ No | `/dashboard` |
| Financial Controller | ❌ No | ❌ No | `/dashboard` |
| Driver | ❌ No | ❌ No | `/dashboard` |

---

## 🎯 Dashboard Behavior by Role

### **Super Admin:**
- **Dashboard Type:** `global`
- **Features:** ALL features available
- **Access:** Full system control
- **Setup Check:** Will redirect to setup if incomplete (after implementation)

### **Operations Manager:**
- **Dashboard Type:** `marketplace`
- **Features:** Marketplace, loads, vehicles, drivers, yard operations
- **Access:** High-level coordination
- **Setup Check:** No (not company owner)

### **Dispatcher:**
- **Dashboard Type:** `active_loads`
- **Features:** Active loads, AI document processing, driver HOS
- **Access:** Real-time execution
- **Financial Rates:** View-only (masked)
- **Setup Check:** No (not company owner)

### **Safety & Compliance:**
- **Dashboard Type:** `eld_violations`
- **Features:** ELD service, inspections, HOS violations, document expiry, maintenance
- **Access:** Audit role
- **Setup Check:** No (not company owner)

### **Financial Controller:**
- **Dashboard Type:** `invoicing`
- **Features:** Invoicing, settlements, IFTA, financial reporting
- **Access:** Accounting role
- **Setup Check:** No (not company owner)

### **Driver:**
- **Dashboard Type:** `mobile`
- **Features:** Assigned loads, POD upload, personal ELD logs
- **Access:** Task completion role
- **Setup Check:** No (not company owner)

---

## 🔐 Security & Access Control

### **Company Isolation:**
- Each company's data is isolated
- Users can only see data from their company
- RLS (Row Level Security) policies enforce this

### **Role-Based Access:**
- Features are filtered by role
- Each role sees different dashboard
- Permissions are enforced server-side

### **Setup Completion:**
- Only Super Admin needs to complete setup
- Other roles don't have setup requirements
- Super Admin setup is mandatory (after implementation)

---

## 📝 Summary

### **For Super Admin (You as Company Owner):**

1. **Register** → Create account + company
2. **Account Setup Wizard** → Complete company profile (5 steps)
3. **Dashboard** → Full access to all features

**Setup Flow:** ✅ **MANDATORY** - You must complete it

### **For Other Roles (Operations Manager, Dispatcher, etc.):**

1. **Register** → Create account (optionally join company)
2. **No Setup Wizard** → Go directly to dashboard
3. **Dashboard** → Role-based features

**Setup Flow:** ❌ **NOT APPLICABLE** - You don't get setup wizard

### **For Driver:**

1. **Register** → Create account (optionally join company)
2. **No Setup Wizard** → Go directly to dashboard
3. **Dashboard** → Mobile-focused features

**Setup Flow:** ❌ **NOT APPLICABLE** - Drivers don't get setup wizard

---

## 🎨 Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    REGISTRATION                         │
│  Choose Role: Super Admin / Operations / Driver / etc.  │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        │                               │
   SUPER ADMIN                    OTHER ROLES
        │                               │
        ↓                               ↓
┌───────────────┐              ┌───────────────┐
│ Create Company│              │ Create Account│
│ Link to User  │              │ (No Company)  │
└───────────────┘              └───────────────┘
        │                               │
        ↓                               ↓
┌───────────────┐              ┌───────────────┐
│ Account Setup │              │   Dashboard   │
│    Wizard     │              │  (Immediate)  │
│  (5 Steps)    │              └───────────────┘
└───────────────┘
        │
        ↓
┌───────────────┐
│   Dashboard   │
│  (After Setup)│
└───────────────┘
```

---

## ✅ Key Takeaways

1. **Only Super Admin gets account setup wizard** - They're the company owner
2. **Other roles go directly to dashboard** - They join existing companies
3. **Setup is mandatory for Super Admin** - Must complete company profile
4. **Role determines dashboard type** - Each role sees different features
5. **Company ID is optional for employees** - Can join later via invitation

---

## 🚀 After Implementation

When account setup flow is implemented:

- **Super Admin** will be **forced** to complete setup before accessing dashboard
- **Other roles** will continue to go directly to dashboard (no change)
- **Setup wizard** will guide Super Admin through company configuration
- **Better onboarding** experience for new company owners


