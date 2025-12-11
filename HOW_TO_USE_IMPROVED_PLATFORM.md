# How to Use the Improved Platform

## 🎉 New Features & Improvements

### 1. Auto-Generate Invoices

**How it works:**
1. Create a load with a `value` and `company_name`
2. When you change the load status to "delivered"
3. **An invoice is automatically created!**

**What gets auto-filled:**
- Invoice number (auto-generated)
- Customer name (from load `company_name`)
- Amount (from load `value`)
- Description (from load details)
- Issue date (current date)
- Due date (30 days from issue date)

**Note:** The invoice will appear in your Invoices list. You can edit it if needed.

---

### 2. Auto-Calculate Settlements

**How it works:**
1. Go to **Accounting → Settlements → Create**
2. Select a **driver** from the dropdown
3. Select **period start** and **period end** dates
4. Click **"Auto-Calculate from Loads & Expenses"** button
5. The system will:
   - Find all loads for that driver in the period
   - Find all fuel expenses for that driver in the period
   - Calculate gross pay (from loads × pay rate)
   - Calculate fuel deduction (from expenses)
   - Calculate net pay
6. Review the calculated values
7. Adjust if needed
8. Click **"Create Settlement"**

**What you'll see:**
- List of loads found for the period
- List of fuel expenses found
- Auto-filled gross pay
- Auto-filled fuel deduction
- Calculated net pay

---

### 3. Invoice Auto-Fill from Load

**How it works:**
1. Go to **Accounting → Invoices → Create**
2. Select a **load** from the dropdown (optional)
3. The system will auto-fill:
   - Customer name
   - Amount
   - Description
4. Adjust dates and payment terms
5. Click **"Create Invoice"**

---

### 4. Expense Auto-Linking

**How it works:**
1. Go to **Accounting → Expenses → Add**
2. Select a **driver** and/or **truck** from dropdowns
3. Enter expense details
4. The system will automatically find matching routes/loads for the same date/driver/truck
5. Click **"Add Expense"**

**Benefits:**
- Expenses are automatically linked to related routes/loads
- Makes it easier to track expenses per route/load
- Used in settlement calculations

---

### 5. Driver Pay Rate

**How to set:**
1. Go to **Drivers → Add Driver** or **Edit Driver**
2. Enter **Pay Rate** (per mile/hour)
3. Save

**How it's used:**
- In settlement calculations
- If pay rate ≤ 1: treated as percentage (multiplies load value)
- If pay rate > 1: treated as per-load amount (multiplies by number of loads)

**Example:**
- Pay rate = 0.25 (25%): Gross pay = sum of load values × 0.25
- Pay rate = 500 (per load): Gross pay = number of loads × 500

---

## 📊 Accounting Reports

All reports calculate automatically and correctly:

### Profit & Loss Report:
- ✅ Revenue = Sum of paid invoices
- ✅ Expenses = Sum of all expenses
- ✅ Net Profit = Revenue - Expenses

### Revenue Report:
- ✅ Total Revenue = Sum of paid invoices
- ✅ By Customer = Groups by customer
- ✅ Average per Load = Calculated correctly

### Driver Payments Report:
- ✅ Total Paid = Sum of paid settlements
- ✅ By Driver = Groups by driver
- ✅ YTD = Year-to-date calculation

---

## 🔗 Data Connections

### Everything is Connected:

1. **Loads ↔ Routes:**
   - Loads can link to routes
   - Loads can auto-create routes

2. **Loads ↔ Invoices:**
   - Invoices link to loads
   - Invoices auto-generated from loads

3. **Loads ↔ Settlements:**
   - Settlements include loads in JSONB
   - Gross pay calculated from loads

4. **Expenses ↔ Settlements:**
   - Fuel deduction calculated from expenses
   - Expenses linked to drivers/trucks

5. **Drivers ↔ Settlements:**
   - Settlements link to drivers
   - Pay rate used for calculations

---

## ✅ Testing Checklist

Test these workflows:

1. **Auto-Invoice:**
   - [ ] Create a load with value and company_name
   - [ ] Change status to "delivered"
   - [ ] Check Invoices list - invoice should be there

2. **Auto-Settlement:**
   - [ ] Create a driver with pay rate
   - [ ] Create loads for that driver
   - [ ] Create fuel expenses for that driver
   - [ ] Create settlement and click "Auto-Calculate"
   - [ ] Verify calculations are correct

3. **Invoice Auto-Fill:**
   - [ ] Go to create invoice
   - [ ] Select a load from dropdown
   - [ ] Verify customer, amount, description are filled

4. **Expense Auto-Link:**
   - [ ] Create expense with driver/truck/date
   - [ ] Verify it links to matching routes/loads

---

## 🎯 Summary

**The platform now:**
- ✅ Auto-generates invoices
- ✅ Auto-calculates settlements
- ✅ Uses dropdowns everywhere
- ✅ Auto-fills forms
- ✅ Auto-links expenses
- ✅ All calculations are automatic and correct

**Much more comfortable and efficient for users!** 🚀
