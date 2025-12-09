# Current Employee Invitation Flow

## Current Implementation

### When Manager Adds Employee:

1. **Manager enters employee email** in `/dashboard/employees`
2. **System checks:**
   - ✅ Email format is valid
   - ✅ Email is not already in the company
   - ✅ No pending invitation exists for this email
   - ✅ Manager cannot add another manager
3. **System generates invitation code** (e.g., `EMP-ABC123XYZ`)
4. **Invitation code is:**
   - ✅ Saved to database (`invitation_codes` table)
   - ✅ Sent to employee's email via Resend
   - ✅ Shown to manager in the UI
5. **Employee receives email** with invitation code

### When Employee Joins:

1. **Employee registers** at `/register/user` (if they don't have account)
2. **Employee goes to account setup** (`/account-setup/user`)
3. **Employee selects** "Work Under Manager Account"
4. **Employee enters invitation code** (from email)
5. **System verifies:**
   - ✅ Code exists and is valid
   - ✅ Code is not expired (30 days)
   - ✅ Code status is "pending"
6. **System links employee to company:**
   - ✅ Sets `company_id` in user record
   - ✅ Sets role to "user"
   - ✅ Updates invitation status to "accepted"

---

## What You're Asking About

You mentioned:
> "it will first check if this account exist in DB and check if it's employee account, right, then if all this match then this account will recieve ID number which manager must enter to asked place"

**This is different from the current flow!**

### Current Flow:
- Manager enters email → Code generated → Code sent to email → Employee uses code

### What You're Describing:
- Manager enters email → System checks if account exists → If exists and is employee → Generate ID → Manager gets ID → Manager enters ID somewhere?

---

## Questions:

1. **Do you want to change the flow?** Or is the current flow okay?

2. **If account doesn't exist yet:**
   - Should manager still be able to send invitation?
   - Or only invite existing accounts?

3. **Where should manager "enter the ID number"?**
   - In a different place?
   - Or just share it with employee?

4. **Should the system check if it's an "employee account"?**
   - What defines an "employee account"?
   - Any account that's not a manager?

---

## Current Behavior:

- ✅ **Works for accounts that don't exist yet** - invitation is sent, employee can register and use code
- ✅ **Works for existing accounts** - if account exists but not in company, they can use code to join
- ✅ **Prevents adding managers** - managers cannot be added as employees
- ✅ **Prevents duplicates** - if already in company, shows error

---

**Let me know if you want to change this flow or if the current implementation is what you need!**

