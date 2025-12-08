# Authentication Flow Documentation

## Complete User Journey

### 1. New User Flow

#### Step 1: Landing Page → Sign In
- User clicks "Sign In" button
- **Action**: Redirects to `/login`

#### Step 2: Login Page
- User enters email/password
- **If user doesn't exist**: Automatically redirects to `/register` (sign up page)
- **If user exists**: Signs in and goes to `/dashboard`

#### Step 3: Sign Up Page (`/register`)
- User chooses account type:
  - **Manager** → Goes to `/register/manager`
  - **Simple User** → Goes to `/register/user`

---

### 2. Manager Account Flow

#### Step 3a: Manager Registration (`/register/manager`)
- User fills in:
  - Company Name
  - Email
  - Password
  - Phone
- **After submit**: Goes to `/plans?type=manager`

#### Step 4a: Subscription Plans (`/plans?type=manager`)
- Manager selects a subscription plan (Simple, Standard, Premium)
- **After selection**: Goes to `/account-setup/manager`

#### Step 5a: Manager Account Setup (`/account-setup/manager`)
- Asks: "Would you like to add employees now?"
- **If Yes**:
  - Shows form to enter employee email
  - Checks if email exists in database
  - Generates unique Employee ID (e.g., `EMP-ABC123XYZ`)
  - Manager can add multiple employees
  - Shows list of generated IDs
- **If Skip**: Goes directly to `/dashboard`
- **After Finish**: Goes to `/dashboard`

---

### 3. Simple User Account Flow

#### Step 3b: User Registration (`/register/user`)
- User fills in:
  - Full Name
  - Email
  - Password
- **After submit**: Goes to `/account-setup/user`

#### Step 4b: User Account Setup (`/account-setup/user`)
- Asks: "How would you like to use TruckMates?"
- **Option 1: Work Individually**
  - Goes to `/plans?type=user`
  - After selecting plan → Goes to `/dashboard`

- **Option 2: Work Under Manager Account**
  - Shows input field for "Manager ID Number"
  - User enters ID provided by manager
  - System verifies ID exists in database
  - **If valid**: Links user to manager's company → Goes to `/dashboard`
  - **If invalid**: Shows error, asks to try again

---

### 4. Existing User Flow

#### Step 1: Login Page (`/login`)
- User enters email/password
- **If credentials valid**: Signs in → Goes to `/dashboard`
- **If credentials invalid**: Shows error message

---

## Route Summary

| Route | Purpose | Next Step |
|-------|---------|-----------|
| `/login` | Sign in existing users | `/dashboard` or `/register` |
| `/register` | Choose account type | `/register/manager` or `/register/user` |
| `/register/manager` | Manager registration form | `/plans?type=manager` |
| `/register/user` | User registration form | `/account-setup/user` |
| `/plans?type=manager` | Manager subscription selection | `/account-setup/manager` |
| `/plans?type=user` | User subscription selection | `/dashboard` |
| `/account-setup/manager` | Add employees, generate IDs | `/dashboard` |
| `/account-setup/user` | Choose individual or manager | `/plans?type=user` or verify manager ID |
| `/dashboard` | Main application | - |

---

## Database Integration Points

### Manager Registration
```typescript
// 1. Create auth user
supabase.auth.signUp({
  email, password,
  options: { data: { full_name, role: 'manager' } }
})

// 2. Create company
supabase.from('companies').insert({
  name, email, phone
})

// 3. Link user to company
supabase.from('users').update({
  company_id, role: 'manager'
})
```

### User Registration
```typescript
// 1. Create auth user
supabase.auth.signUp({
  email, password,
  options: { data: { full_name, role: 'user' } }
})
```

### Manager ID Verification
```typescript
// Check if manager ID exists
supabase.from('companies')
  .select('id, manager_id')
  .eq('manager_id', enteredId)
  .single()

// Link user to company
supabase.from('users').update({
  company_id: company.id
})
```

### Employee ID Generation
```typescript
// When manager adds employee:
// 1. Check if email exists
supabase.from('users')
  .select('id, email')
  .eq('email', employeeEmail)
  .single()

// 2. Generate unique ID
const employeeId = `EMP-${generateUniqueId()}`

// 3. Store in database (new table: employee_invitations)
supabase.from('employee_invitations').insert({
  company_id,
  email: employeeEmail,
  employee_id: employeeId,
  status: 'pending'
})
```

---

## Key Features

### ✅ Implemented
- Login page with automatic redirect to sign up for new users
- Manager and User registration forms
- Account setup pages for both types
- Subscription plan selection
- Manager employee invitation system
- Manager ID verification for users
- Flow routing between pages

### 🔄 To Be Integrated with Supabase
- Actual authentication (currently simulated)
- Database queries for user verification
- Company creation and linking
- Employee ID generation and storage
- Manager ID verification
- Subscription plan storage

---

## User Experience Flow Diagram

```
Landing Page
    ↓
[Sign In Button]
    ↓
Login Page
    ├─→ User exists? → Dashboard
    └─→ User new? → Register Page
            ↓
    [Choose Type]
        ├─→ Manager
        │     ↓
        │   Manager Registration
        │     ↓
        │   Subscription Plans
        │     ↓
        │   Account Setup (Add Employees)
        │     ↓
        │   Dashboard
        │
        └─→ Simple User
              ↓
            User Registration
              ↓
            Account Setup
              ├─→ Work Individually → Plans → Dashboard
              └─→ Work Under Manager → Enter Manager ID → Dashboard
```

---

## Next Steps for Full Integration

1. **Connect to Supabase Auth**
   - Replace simulated login/register with actual Supabase auth calls
   - Handle authentication errors properly

2. **Create Employee Invitations Table**
   ```sql
   CREATE TABLE employee_invitations (
     id UUID PRIMARY KEY,
     company_id UUID REFERENCES companies(id),
     email TEXT NOT NULL,
     employee_id TEXT UNIQUE NOT NULL,
     status TEXT DEFAULT 'pending',
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Add Manager ID to Companies Table**
   ```sql
   ALTER TABLE companies 
   ADD COLUMN manager_id TEXT UNIQUE;
   ```

4. **Implement ID Generation Logic**
   - Generate unique manager IDs when company is created
   - Generate unique employee IDs when manager adds employees

5. **Add Subscription Management**
   - Store subscription plans in database
   - Link subscriptions to companies/users
   - Handle subscription status

