# Account Setup Flow - Implementation Plan

## 🎯 Overview

Create a guided multi-step onboarding wizard that helps new Super Admin users complete their company setup after registration.

---

## 📋 Step-by-Step Plan

### **Step 1: Database Schema Updates**

**File:** `supabase/account_setup_schema.sql` (new file)

**What to Add:**
- Add `setup_complete` boolean field to `companies` table
- Add `setup_completed_at` timestamp field
- Add `setup_data` JSONB field (optional, for storing setup progress)

**SQL:**
```sql
-- Add setup tracking to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS setup_data JSONB DEFAULT '{}'::jsonb;
```

**Why:** Track which companies have completed setup, and when.

---

### **Step 2: Server Actions for Setup**

**File:** `app/actions/account-setup.ts` (new file)

**Functions to Create:**

1. **`getSetupStatus()`**
   - Check if company setup is complete
   - Return current setup progress
   - Used by dashboard layout to redirect if incomplete

2. **`updateCompanyProfile(data)`**
   - Update company address, phone, business details
   - Save to `companies` table
   - Return JSON-serializable result

3. **`createFirstDriver(data)`**
   - Create first driver during setup
   - Optional step
   - Uses existing driver creation logic

4. **`createFirstTruck(data)`**
   - Create first truck during setup
   - Optional step
   - Uses existing truck creation logic

5. **`importDemoData()`**
   - Import sample data if user chooses
   - Uses existing demo data function
   - Optional step

6. **`completeSetup()`**
   - Mark `setup_complete = true`
   - Set `setup_completed_at = now()`
   - Redirect to dashboard

**Why:** Handle all setup operations server-side with proper error handling.

---

### **Step 3: Multi-Step Wizard Component**

**File:** `components/account-setup/setup-wizard.tsx` (new file)

**Structure:**
```typescript
interface SetupWizardProps {
  companyId: string
  initialData?: {
    companyName: string
    email: string
    phone: string
  }
}

// Steps:
// 1. Company Information
// 2. Add First Driver (optional)
// 3. Add First Truck (optional)
// 4. Import Demo Data (optional)
// 5. Complete & Welcome
```

**Features:**
- Progress bar showing current step (1/5, 2/5, etc.)
- Step navigation (Next, Back, Skip)
- Form validation
- Loading states
- Error handling
- Responsive design

**Why:** Reusable component that handles the entire wizard flow.

---

### **Step 4: Individual Step Components**

**Files to Create:**

1. **`components/account-setup/step-company-info.tsx`**
   - Form for company address, phone, business type
   - Google Maps autocomplete (reuse from settings)
   - Validation

2. **`components/account-setup/step-first-driver.tsx`**
   - Form for first driver
   - Reuse driver form components
   - "Skip" option

3. **`components/account-setup/step-first-truck.tsx`**
   - Form for first truck
   - Reuse truck form components
   - "Skip" option

4. **`components/account-setup/step-demo-data.tsx`**
   - Yes/No choice
   - Explanation of what demo data includes
   - Loading state during import

5. **`components/account-setup/step-complete.tsx`**
   - Success message
   - "Go to Dashboard" button
   - Optional "Take Tour" button

**Why:** Modular components for each step, easier to maintain.

---

### **Step 5: Update Account Setup Page**

**File:** `app/account-setup/manager/page.tsx` (update existing)

**Changes:**
- Remove immediate redirect
- Add setup wizard component
- Fetch company data
- Handle completion redirect
- Show loading state

**Why:** Main page that hosts the wizard.

---

### **Step 6: Update Dashboard Layout**

**File:** `app/dashboard/layout.tsx` (update existing)

**Changes:**
- Check `setup_complete` status
- If `false` and user is `super_admin`, redirect to `/account-setup/manager`
- Only check once (prevent redirect loops)
- Skip check for account-setup pages

**Why:** Ensure users complete setup before accessing dashboard.

---

### **Step 7: Update Registration Flow**

**File:** `app/register/super-admin/page.tsx` (verify)

**Current:** Already redirects to `/account-setup/manager` ✅

**No changes needed** - already correct.

---

## 🎨 UI/UX Design

### **Wizard Layout:**
```
┌─────────────────────────────────────────┐
│  TruckMates Logo                       │
│  ───────────────────────────────────── │
│  Step 2 of 5                           │
│  ████████░░░░░░░░░░░░░░░░░░░░░░ 40%    │
│                                        │
│  Add Your First Driver                │
│  (Optional - You can skip this step)   │
│                                        │
│  [Form Fields]                         │
│                                        │
│  [← Back]  [Skip]  [Add Driver →]     │
└─────────────────────────────────────────┘
```

### **Progress Indicator:**
- Visual progress bar
- Step numbers (1/5, 2/5, etc.)
- Checkmarks for completed steps

### **Step Navigation:**
- "Back" button (except step 1)
- "Skip" button (for optional steps)
- "Next" button (with validation)
- "Complete" button (final step)

---

## 📁 File Structure

```
app/
  account-setup/
    manager/
      page.tsx                    # Main setup page (UPDATE)
  actions/
    account-setup.ts              # Server actions (NEW)

components/
  account-setup/
    setup-wizard.tsx              # Main wizard component (NEW)
    step-company-info.tsx         # Step 1 component (NEW)
    step-first-driver.tsx         # Step 2 component (NEW)
    step-first-truck.tsx          # Step 3 component (NEW)
    step-demo-data.tsx            # Step 4 component (NEW)
    step-complete.tsx             # Step 5 component (NEW)

supabase/
  account_setup_schema.sql       # Database updates (NEW)
```

---

## 🔄 Flow Diagram

```
Registration
    ↓
Create Account & Company
    ↓
Redirect to /account-setup/manager
    ↓
┌─────────────────────────┐
│  Step 1: Company Info   │
│  - Address              │
│  - Phone                │
│  - Business Type        │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│  Step 2: First Driver   │
│  - Name, Email, Phone   │
│  - [Skip] option        │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│  Step 3: First Truck    │
│  - VIN, Make, Model     │
│  - [Skip] option        │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│  Step 4: Demo Data?     │
│  - Yes/No choice        │
│  - Import if Yes        │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│  Step 5: Complete!      │
│  - Success message      │
│  - [Go to Dashboard]    │
└─────────────────────────┘
    ↓
Mark setup_complete = true
    ↓
Redirect to Dashboard
```

---

## ✅ Implementation Checklist

### Phase 1: Database & Backend (1 hour)
- [ ] Create `account_setup_schema.sql`
- [ ] Run SQL in Supabase
- [ ] Create `app/actions/account-setup.ts`
- [ ] Implement all server action functions
- [ ] Test server actions

### Phase 2: Wizard Components (2 hours)
- [ ] Create `setup-wizard.tsx` main component
- [ ] Create `step-company-info.tsx`
- [ ] Create `step-first-driver.tsx`
- [ ] Create `step-first-truck.tsx`
- [ ] Create `step-demo-data.tsx`
- [ ] Create `step-complete.tsx`
- [ ] Add progress bar component
- [ ] Add navigation logic

### Phase 3: Integration (1 hour)
- [ ] Update `app/account-setup/manager/page.tsx`
- [ ] Update `app/dashboard/layout.tsx`
- [ ] Test complete flow
- [ ] Fix any bugs

### Phase 4: Polish (1 hour)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success animations
- [ ] Test on mobile
- [ ] Final testing

**Total Estimated Time: 4-5 hours**

---

## 🎯 Key Features

### **1. Smart Defaults**
- Pre-fill company name, email, phone from registration
- Auto-save progress (optional)
- Remember skipped steps

### **2. Flexible Flow**
- All steps optional except company info
- Can skip driver, truck, demo data
- Can complete setup in any order (future enhancement)

### **3. User-Friendly**
- Clear progress indication
- Helpful tooltips
- Validation with clear error messages
- Mobile-responsive

### **4. Error Handling**
- Graceful error messages
- Retry options
- Fallback to manual setup

---

## 🔒 Security Considerations

1. **Authentication Check**
   - Only authenticated Super Admin can access
   - Verify company ownership

2. **Data Validation**
   - Validate all inputs server-side
   - Sanitize user data

3. **RLS Policies**
   - Ensure company data isolation
   - Use existing RLS policies

---

## 📊 Success Metrics

After implementation:
- ✅ Users complete setup faster
- ✅ More companies have complete profiles
- ✅ Higher initial data entry (drivers/trucks)
- ✅ Reduced support questions

---

## 🚀 Next Steps

1. Review this plan
2. Approve implementation approach
3. Start with Phase 1 (Database & Backend)
4. Iterate through phases
5. Test thoroughly
6. Deploy

---

## 💡 Future Enhancements (Optional)

- **Progress Persistence:** Save progress between sessions
- **Welcome Tour:** Interactive tour of dashboard
- **Video Tutorials:** Embedded videos for each step
- **Template Selection:** Choose industry templates
- **Bulk Import:** Import drivers/trucks from CSV
- **Integration Setup:** Connect integrations during setup

---

## ❓ Questions to Consider

1. **Should setup be mandatory?** (Yes - redirect if incomplete)
2. **Can users skip all optional steps?** (Yes)
3. **Should progress be saved?** (Optional - can add later)
4. **What happens if user closes browser?** (Can resume - if we add persistence)

---

## ✅ Ready to Implement?

This plan provides:
- ✅ Clear structure
- ✅ Step-by-step approach
- ✅ Reusable components
- ✅ Proper error handling
- ✅ Security considerations
- ✅ Estimated timeline

**Ready to start implementation when you approve!**

