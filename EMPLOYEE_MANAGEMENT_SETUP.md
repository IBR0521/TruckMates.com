# Employee Management System - Setup Guide

## ✅ Implementation Complete!

The employee management system has been fully implemented with all requested features.

---

## 🎯 Features Implemented

### 1. **Employee Invitation System**
- ✅ Managers can add employees by email
- ✅ If employee doesn't have an account, invitation code is generated
- ✅ Invitation codes are sent to employee's email via Resend
- ✅ Invitation codes are stored in database with expiration (30 days)
- ✅ Employees can use invitation code to join company

### 2. **Access Control**
- ✅ Only managers can add employees
- ✅ Managers cannot add other managers
- ✅ Employees cannot add other accounts
- ✅ Employees cannot see employee management dashboard
- ✅ Employee management page is only visible to managers

### 3. **Employee Management Page**
- ✅ Full employee list with search functionality
- ✅ Add new employees (sends invitation)
- ✅ Edit employee details (name, email, phone, position, status)
- ✅ Remove employees from company
- ✅ View pending invitations
- ✅ Cancel pending invitations

---

## 📋 Database Schema

### New Tables

**`invitation_codes` table:**
- Stores employee invitation codes
- Links to company and creator
- Tracks status (pending, accepted, expired, cancelled)
- Has expiration date (30 days default)

### Updated Tables

**`users` table - New fields:**
- `position` - Employee position/role
- `employee_status` - Status (active, inactive, suspended)

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open the file: `supabase/employee_management_schema.sql`
3. Copy and paste the entire SQL script
4. Click **Run** to execute

This will:
- Add `position` and `employee_status` fields to `users` table
- Create `invitation_codes` table
- Set up RLS policies
- Create helper functions

### Step 2: Verify Environment Variables

Make sure these are set in your `.env.local`:
```env
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_verified_email@yourdomain.com
NEXT_PUBLIC_APP_URL=https://truckmateslogistic.com
```

### Step 3: Test the System

1. **As Manager:**
   - Go to `/dashboard/employees`
   - Click "Add Employee"
   - Enter employee email
   - Invitation code will be sent to their email

2. **As Employee:**
   - Register at `/register/user`
   - Go to account setup
   - Select "Work Under Manager Account"
   - Enter invitation code
   - Account will be linked to company

---

## 📁 Files Created/Modified

### New Files:
- `supabase/employee_management_schema.sql` - Database schema
- `app/actions/employees.ts` - Server actions for employee management
- `app/dashboard/employees/page.tsx` - Employee management page

### Modified Files:
- `app/account-setup/manager/page.tsx` - Now saves invitations to database
- `app/account-setup/user/page.tsx` - Now verifies invitation codes
- `components/dashboard/sidebar.tsx` - Added Employees link (managers only)

---

## 🔐 Security Features

### Row Level Security (RLS)
- ✅ Managers can only view employees in their company
- ✅ Managers can only create invitations for their company
- ✅ Employees cannot access employee management features
- ✅ Managers cannot add other managers
- ✅ Managers cannot delete themselves

### Access Control
- ✅ Server-side role verification
- ✅ Client-side UI hiding for non-managers
- ✅ Database-level RLS policies

---

## 📧 Email Notifications

When a manager adds an employee:
1. Invitation code is generated (format: `EMP-ABC123XYZ`)
2. Email is sent to employee with:
   - Invitation code
   - Instructions on how to use it
   - Link to registration page
   - Expiration date

**Note:** If Resend is not configured, invitation codes are still generated and shown to the manager, but emails won't be sent.

---

## 🎨 UI Features

### Employee Management Page (`/dashboard/employees`)
- **Pending Invitations Section:**
  - Shows all pending invitations
  - Displays invitation code
  - Shows expiration date
  - Cancel button

- **Employees List:**
  - Search functionality
  - Table view with all employee details
  - Status badges (Active, Inactive, Suspended)
  - Edit and Delete actions

- **Add Employee Dialog:**
  - Simple email input
  - Sends invitation automatically

- **Edit Employee Dialog:**
  - Update name, email, phone
  - Set position
  - Change status

---

## 🔄 Workflow

### Manager Adding Employee:
1. Manager goes to `/dashboard/employees`
2. Clicks "Add Employee"
3. Enters employee email
4. System checks:
   - Email format valid
   - Email not already in company
   - User is manager
5. Invitation code generated
6. Email sent to employee (if Resend configured)
7. Invitation appears in "Pending Invitations"

### Employee Joining Company:
1. Employee registers at `/register/user`
2. Goes to account setup
3. Selects "Work Under Manager Account"
4. Enters invitation code
5. System verifies:
   - Code exists and is valid
   - Code not expired
   - Code not already used
6. User account linked to company
7. Invitation status updated to "accepted"
8. Employee redirected to dashboard

---

## 🐛 Troubleshooting

### Invitation codes not being sent via email:
- Check `RESEND_API_KEY` is set
- Check `RESEND_FROM_EMAIL` is verified in Resend
- Check Resend domain is verified
- Check console logs for errors

### Employees page not showing:
- Verify user role is "manager" in database
- Check RLS policies are applied
- Clear browser cache

### Invitation code not working:
- Check code is not expired (30 days)
- Check code status is "pending"
- Verify code format matches (EMP-XXXXXXXXX)

---

## 📝 Next Steps

1. **Run the database migration** (`supabase/employee_management_schema.sql`)
2. **Test the system** with a manager and employee account
3. **Configure Resend** if you want email notifications
4. **Customize** employee positions and statuses as needed

---

## ✨ Summary

The employee management system is now fully functional with:
- ✅ Database integration
- ✅ Email notifications
- ✅ Access control
- ✅ Full CRUD operations
- ✅ Beautiful UI
- ✅ Security policies

**Everything is ready to use!** 🚀

